export const meterConstants=Object.freeze({turnsPerLiter:40,litersPerSweep:1,screenDuration:20,registerLiters:10000000,registerDigits:7});
export const meterSizes=Object.freeze({
  0:Object.freeze({label:'Q3 2.5 m³/h · R160',permanent:2500/60,ratio:160,starting:.06,dropAtQ3:.25}),
  1:Object.freeze({label:'Q3 4 m³/h · R100',permanent:4000/60,ratio:100,starting:.12,dropAtQ3:.16}),
});
export const METER_DEFAULTS=Object.freeze({flow:6,leak:0,size:0,bias:0,duration:20,initial:0});
export const METER_DOMAINS=Object.freeze({flow:[0,80,.05],leak:[0,.5,.005],size:[0,1,1],bias:[-4,4,.5],duration:[20,86400,1],initial:[0,9999999,1]});
export const METER_DURATIONS=Object.freeze([{value:20,label:'20 seconds · real time'},{value:1800,label:'30 minutes · 90× time-lapse'},{value:86400,label:'24 hours · 4320× time-lapse'}]);
export const METER_INITIALS=Object.freeze([0,9,99,999,9999999].map(value=>({value,label:(value/1000).toFixed(3).padStart(8,'0')+' m³'})));
const clamp=x=>Math.max(0,Math.min(1,x));
const modulo=(x,n)=>{const remainder=x%n;return remainder<0?remainder+n:remainder;};

export function meterResponse(flowLitersPerMinute,size=0,bias=0){
 const spec=meterSizes[size]??meterSizes[0],flow=Number.isFinite(flowLitersPerMinute)?Math.max(0,flowLitersPerMinute):0;
 const calibration=Number.isFinite(bias)?Math.max(-4,Math.min(4,bias)):0;
 const q3=spec.permanent,q1=q3/spec.ratio,q2=1.6*q1,q4=1.25*q3;
 const u=clamp((flow-spec.starting)/(q1-spec.starting));
 const response=u*u*(3-2*u)*(1+calibration/100),registered=flow*response;
 const error=flow>0?response-1:null;
 const limit=flow<q1||flow>q4?null:flow<q2?.05:.02;
 const band=flow===0?'No flow':flow<=spec.starting?'Below illustrative starting flow':flow<q1?'Below Q1 · no accuracy comparison':flow<q2?'Q1 to Q2 · ±5% comparison':flow<=q3?'Q2 to Q3 · ±2% comparison':flow<=q4?'Q3 to Q4 · short overload range':'Above Q4 · outside rated comparison';
 return {...spec,q1,q2,q3,q4,flow,calibration,response,registered,error,limit,band,
  turning:registered>0,starWheel:registered>0,unregistered:flow-registered,
  impellerTurnsPerMinute:registered*meterConstants.turnsPerLiter,
  pointerTurnsPerMinute:registered,indicatorTurnsPerMinute:registered*2,
  withinBand:limit===null?null:Math.abs(error)<=limit+1e-12,
  drop:spec.dropAtQ3*(flow/q3)**2};
}

// Higher rollers carry only while the lower roller changes from 9 to 0.
// At a cascade, every affected roller advances during the same final liter.
export function meterDigitPosition(liters,place){
 return Math.floor(liters/place)+clamp(modulo(liters,place)-(place-1));
}

export function sampleWaterMeter(values,screenTime){
 const clock=Math.max(0,Math.min(meterConstants.screenDuration,Number.isFinite(screenTime)?screenTime:0));
 const elapsed=clock*values.duration/meterConstants.screenDuration;
 const response=meterResponse(values.flow+values.leak,values.size,values.bias);
 const deliveredVolume=response.flow*elapsed/60,registeredVolume=response.registered*elapsed/60;
 const total=values.initial+registeredVolume,reading=modulo(total,meterConstants.registerLiters);
 const positions=Array.from({length:7},(_,i)=>meterDigitPosition(total,10**i));
 return {...response,clock,elapsed,complete:clock===meterConstants.screenDuration,
  stage:clock===0?'ready':clock===meterConstants.screenDuration?'complete':'running',
  deliveredVolume,registeredVolume,missed:deliveredVolume-registeredVolume,
  total,reading,cubicMeters:registeredVolume/1000,displayCubicMeters:reading/1000,
  rollovers:Math.floor(total/meterConstants.registerLiters),
  impellerTurns:registeredVolume*40,pointerTurns:registeredVolume,indicatorTurns:registeredVolume*2,
  positions,transferTurns:positions.slice(1).map(value=>value/4),
  dayDelivered:response.flow*1440,dayRegistered:response.registered*1440,
  display:Math.floor(reading).toString().padStart(7,'0'),
  timeScale:values.duration/meterConstants.screenDuration};
}

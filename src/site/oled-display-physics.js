import {validateControls, clamp} from './physics-kit.js';

// Assigned teaching circuit, not parameters of a commercial OLED panel.
export const OLED = Object.freeze({
  rows:3, columns:3, rail:8, threshold:1, k:.5e-6, maxOverdrive:2,
  capacitance:.5e-12, writeTau:20e-6, leakTau:.05, rowStart:.0005,
  rowPulse:120e-6, frame:1/60, frames:12, slow:100,
  oledIntercept:3, oledResistance:150e3, externalYield:.20, electronicsPower:50e-6,
  electronCharge:1.602176634e-19, planck:6.62607015e-34, lightSpeed:299792458,
  wavelengths:Object.freeze([630e-9,530e-9,460e-9]),
});
export const OLED_DURATION = OLED.frames*OLED.frame;
export const OLED_PLAYBACK_DURATION = OLED_DURATION*OLED.slow;
export const OLED_MAX_CURRENT = OLED.k*OLED.maxOverdrive**2;
export const OLED_DEFAULTS = Object.freeze({red:100,green:22,blue:0,pattern:0,addressing:0,circuit:0,retention:0});
export const OLED_DOMAINS = Object.freeze({red:[0,100,1],green:[0,100,1],blue:[0,100,1],pattern:[0,2,1],addressing:[0,3,1],circuit:[0,2,1],retention:[0,1,1]});

export function oledTargetVoltage(percent) {
  if(!Number.isFinite(percent)||percent<0||percent>100)throw new RangeError('Expected OLED target percentage from 0 to 100');
  return percent===0?0:OLED.threshold+OLED.maxOverdrive*Math.sqrt(percent/100);
}

export function oledCurrent(sourceGateVoltage) {
  if(!Number.isFinite(sourceGateVoltage)||sourceGateVoltage<0)throw new RangeError('Expected nonnegative OLED source-to-gate voltage');
  return OLED.k*Math.max(0,sourceGateVoltage-OLED.threshold)**2;
}

export function oledRowStart(frame,row) {return frame*OLED.frame+OLED.rowStart+row*OLED.frame/OLED.rows;}
export function oledPixelActive(pattern,row,column) {return pattern===1||pattern===0&&row===1&&column===1||pattern===2&&(row+column)%2===0;}

function voltageAt(segment,dt) {
  return segment.tau===Infinity?segment.start:segment.start+(segment.target-segment.start)*(-Math.expm1(-dt/segment.tau));
}

// Exact integral of K max(VSG - |Vth|, 0)^2 on a monotonic RC segment.
function currentIntegral(segment,dt) {
  if(dt<=0)return 0;
  if(segment.tau===Infinity)return oledCurrent(segment.start)*dt;
  const first=segment.start-OLED.threshold,last=voltageAt(segment,dt)-OLED.threshold;
  if(first<=0&&last<=0)return 0;
  let lo=0,hi=dt;
  if(first*last<0){
    const crossing=-segment.tau*Math.log((OLED.threshold-segment.target)/(segment.start-segment.target));
    if(first<0)lo=crossing;else hi=crossing;
  }
  const duration=hi-lo,a=segment.target-OLED.threshold,b=voltageAt(segment,lo)-segment.target;
  const integral=a*a*duration+2*a*b*segment.tau*(-Math.expm1(-duration/segment.tau))+
    b*b*segment.tau/2*(-Math.expm1(-2*duration/segment.tau));
  return Math.max(0,OLED.k*integral);
}

function buildTrace(values,row,percent) {
  const segments=[],writes=[],leakTau=values.retention?OLED.leakTau:Infinity;
  let time=0,held=0,charge=0;
  function add(end,target,tau,selected=false,frame=-1) {
    if(end<=time)return;
    const segment={begin:time,end,start:held,target,tau,selected,frame,charge};
    charge+=currentIntegral(segment,end-time);held=voltageAt(segment,end-time);time=end;segments.push(segment);
  }
  for(let frame=0;frame<OLED.frames;frame++) {
    if(values.addressing===2||values.addressing===1&&frame>0)continue;
    const begin=oledRowStart(frame,row),end=begin+OLED.rowPulse;
    const target=oledTargetVoltage(values.addressing===3&&frame>0?0:percent);
    add(begin,0,leakTau);
    const tau=1/(1/OLED.writeTau+1/leakTau),asymptote=target*tau/OLED.writeTau;
    writes.push({begin,end,frame,target});add(end,asymptote,tau,true,frame);
  }
  add(OLED_DURATION,0,leakTau);
  return {segments,writes};
}

function sampleTrace(trace,time) {
  const segment=trace.segments.find(s=>time<s.end)||trace.segments.at(-1),dt=Math.max(0,time-segment.begin);
  const voltage=voltageAt(segment,dt),lastWrite=trace.writes.findLast(w=>time>=w.begin);
  return {voltage,charge:segment.charge+currentIntegral(segment,dt),selected:segment.selected&&time<segment.end,
    writes:trace.writes.filter(w=>time>=w.begin).length,dataTarget:lastWrite?.target??0};
}

export function createOledPlan(given={}) {
  const values=validateControls(given,OLED_DEFAULTS,OLED_DOMAINS,'OLED display');
  const targets=[values.red,values.green,values.blue],traces=Array.from({length:OLED.rows},(_,row)=>targets.map(percent=>buildTrace(values,row,percent)));
  return {values,targets,traces};
}

export function oledDisplayState(plan,time) {
  if(!Number.isFinite(time)||time<0||time>OLED_DURATION+1e-12)throw new RangeError('OLED time is outside the physical record');
  time=Math.min(time,OLED_DURATION);
  const {values,targets,traces}=plan,cutoff=values.circuit===1?0:values.circuit===2?OLED.frame:OLED_DURATION;
  const circuitClosed=values.circuit===0||values.circuit===2&&time<OLED.frame;
  const rows=traces.map((row,index)=>({index,channels:row.map(trace=>sampleTrace(trace,time)),
    delivered:row.map(trace=>sampleTrace(trace,Math.min(time,cutoff)).charge)}));
  const selectedRow=rows.find(row=>row.channels[0].selected)?.index??null;
  const pixels=[];
  let emitterCurrent=0,emitterCharge=0,oledPower=0,opticalPower=0,drivePower=0,photons=0;
  for(let row=0;row<OLED.rows;row++)for(let column=0;column<OLED.columns;column++){
    const active=oledPixelActive(values.pattern,row,column),channels=rows[row].channels.map((channel,i)=>{
      const voltage=active?channel.voltage:0,demand=oledCurrent(voltage),current=circuitClosed?demand:0;
      const junctionVoltage=current>0?OLED.oledIntercept+OLED.oledResistance*current:null;
      const sourceDrainVoltage=current>0?OLED.rail-junctionVoltage:null;
      const photonRate=OLED.externalYield*current/OLED.electronCharge;
      const photonEnergy=OLED.planck*OLED.lightSpeed/OLED.wavelengths[i],lightPower=photonRate*photonEnergy;
      const charge=active?rows[row].delivered[i]:0;
      const junctionPower=current>0?junctionVoltage*current:0;
      emitterCurrent+=current;emitterCharge+=charge;oledPower+=junctionPower;
      opticalPower+=lightPower;drivePower+=current>0?sourceDrainVoltage*current:0;photons+=photonRate;
      return {voltage,gateVoltage:OLED.rail-voltage,storedCharge:OLED.capacitance*voltage,
        target:active?targets[i]:0,dataVoltage:OLED.rail-(active?channel.dataTarget:0),demand,current,
        light:current/OLED_MAX_CURRENT,junctionVoltage,sourceDrainVoltage,
        saturationMargin:current>0?sourceDrainVoltage-Math.max(0,voltage-OLED.threshold):null,
        photonRate,photonEnergy,opticalPower:lightPower,oledPower:junctionPower,
        charge,photons:OLED.externalYield*charge/OLED.electronCharge};
    });
    pixels.push({row,column,active,selected:row===selectedRow,writes:rows[row].channels[0].writes,channels});
  }
  const center=pixels[4],supplyPower=OLED.rail*emitterCurrent;
  return {values:{...values},time,clock:time*OLED.slow,done:time>=OLED_DURATION,rows,pixels,center,selectedRow,circuitClosed,
    total:{current:emitterCurrent,charge:emitterCharge,photons,emittedPhotons:OLED.externalYield*emitterCharge/OLED.electronCharge,
      supplyPower,oledPower,opticalPower,drivePower,oledHeat:oledPower-opticalPower,
      electronicsPower:OLED.electronicsPower,power:supplyPower+OLED.electronicsPower,
      emitterEnergy:OLED.rail*emitterCharge,electronicsEnergy:OLED.electronicsPower*time,
      energy:OLED.rail*emitterCharge+OLED.electronicsPower*time},
    targetLight:targets.map(v=>v/100),light:center.channels.map(c=>c.light),
  };
}

export function createOledDisplayController(initial={}) {
  let plan=createOledPlan(),clock=0;
  const getState=()=>oledDisplayState(plan,clock/OLED.slow);
  function reset(next={}) {
    if(!next||typeof next!=='object'||Array.isArray(next))throw new TypeError('Expected OLED initial state');
    for(const key of Object.keys(next))if(!['settings','time'].includes(key))throw new RangeError(`Unknown OLED initial field ${key}`);
    const nextPlan=createOledPlan(next.settings??{}),nextTime=next.time??0;
    if(!Number.isFinite(nextTime)||nextTime<0||nextTime>OLED_PLAYBACK_DURATION)throw new RangeError('Invalid OLED initial time');
    plan=nextPlan;clock=nextTime;return getState();
  }
  function update(changes={}) {
    const values=validateControls(changes,plan.values,OLED_DOMAINS,'OLED display');
    if(Object.keys(values).some(key=>values[key]!==plan.values[key])){plan=createOledPlan(values);clock=0;}
    return getState();
  }
  function advance(seconds) {
    if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('Expected nonnegative OLED playback interval');
    const next=clock+seconds;
    clock=next>=OLED_PLAYBACK_DURATION-1e-12?OLED_PLAYBACK_DURATION:clamp(next/OLED_PLAYBACK_DURATION)*OLED_PLAYBACK_DURATION;return getState();
  }
  reset(initial);
  return {getState,reset,update,advance,getPlan:()=>structuredClone(plan),replayState:()=>({settings:{...plan.values},time:0})};
}

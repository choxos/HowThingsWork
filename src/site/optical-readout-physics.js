import {validateControls,validTime} from './physics-kit.js';

export const READOUT_DEFAULTS=Object.freeze({pattern:0,power:100,blocked:0,noise:0,decoder:0});
export const READOUT_DOMAINS=Object.freeze({pattern:[0,1,1],power:[0,100,5],blocked:[0,1,1],noise:[0,2,1],decoder:[0,1,1]});
export const READOUT=Object.freeze({cellsPerSecond:3,channelRate:66e6,wavelength:405,responsivity:.2,power:40e-6,transimpedance:100000,low:.25,high:.75,noiseAmps:[0,.45e-6,1.2e-6]});
const RUNS=Object.freeze([[3,2,4,3,5,2,4,3],[2,5,3,4,2,6,3,3]].map(Object.freeze));

export function readoutTrack(pattern=0){
  if(![0,1].includes(pattern))throw new RangeError('Unknown readout track');
  const levels=RUNS[pattern].flatMap((length,i)=>Array(length).fill(i%2));
  const bits=levels.map((level,i)=>Number(level!==(i?levels[i-1]:1)));
  return {runs:RUNS[pattern],levels,bits,cells:levels.length};
}

/** Illustrative PR(1,2,1)/4 response, not an optical diffraction calculation. */
export function readoutTarget(levels){
  if(!Array.isArray(levels)||levels.some(x=>x!==0&&x!==1))throw new TypeError('Expected binary readout levels');
  return levels.map((x,i)=>(x+2*(i?levels[i-1]:1)+(i>1?levels[i-2]:1))/4);
}

/** Four-state minimum squared-error path. Only received samples enter detection. */
export function readoutDetect(samples,mode=0){
  if(!Array.isArray(samples)||samples.some(x=>!Number.isFinite(x))||![0,1].includes(mode))throw new TypeError('Invalid readout samples or detector');
  if(mode===1){const levels=samples.slice(1,-1).map(x=>Number(x>=.5));return {levels,bits:levels.map((x,i)=>Number(x!==(i?levels[i-1]:1))),metric:null};}
  let states=[null,null,null,{metric:0,levels:[]}];
  for(const sample of samples){
    const next=Array(4).fill(null);
    for(let state=0;state<4;state++)if(states[state])for(let bit=0;bit<2;bit++){
      const expected=(bit+2*(state&1)+(state>>1))/4,index=((state&1)<<1)|bit;
      const metric=states[state].metric+(sample-expected)**2;
      if(!next[index]||metric<next[index].metric)next[index]={metric,levels:[...states[state].levels,bit]};
    }
    states=next;
  }
  const best=states.filter(Boolean).reduce((a,b)=>b.metric<a.metric?b:a);
  // Two sample intervals of look-ahead; displayed prefix remains a provisional estimate.
  const levels=best.levels.slice(0,Math.max(0,samples.length-2));
  return {levels,bits:levels.map((x,i)=>Number(x!==(i?levels[i-1]:1))),metric:best.metric};
}

// Fixed Gaussian test noise makes comparisons repeatable; it is not measured disc noise.
function noiseAt(index){
  const uniform=n=>{let x=(n+1)*0x9e3779b1>>>0;x^=x>>>16;x=Math.imul(x,0x21f0aaad);x^=x>>>15;x=Math.imul(x,0x735a2d97);return ((x^(x>>>15))>>>0)+1;};
  const u=uniform(index*2)/4294967297,v=uniform(index*2+1)/4294967297;
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}

export function readoutPlan(input={}){
  const values=validateControls(input,READOUT_DEFAULTS,READOUT_DOMAINS,'optical readout'),track=readoutTrack(values.pattern);
  const target=readoutTarget([...track.levels,1,1]),scale=values.blocked?0:values.power/100;
  const lowCurrent=READOUT.responsivity*READOUT.power*READOUT.low*scale;
  const swing=READOUT.responsivity*READOUT.power*(READOUT.high-READOUT.low)*scale;
  const light=target.map(x=>READOUT.power*scale*(READOUT.low+(READOUT.high-READOUT.low)*x));
  const current=light.map(x=>READOUT.responsivity*x),noise=target.map((_,i)=>noiseAt(i)*READOUT.noiseAmps[values.noise]);
  const voltage=current.map((x,i)=>(x+noise[i])*READOUT.transimpedance);
  return {values,track,target,lightSamples:light,currentSamples:current,noise,voltageSamples:voltage,lowCurrent,swing,sampleCount:target.length,duration:target.length/READOUT.cellsPerSecond};
}

export function readoutAt(plan,time){
  validTime(time);const clock=Math.min(time,plan.duration),travel=clock*READOUT.cellsPerSecond;
  const sampleCount=Math.min(plan.sampleCount,Math.floor(travel+1e-10)),received=plan.voltageSamples.slice(0,sampleCount);
  const normalized=plan.swing>0?received.map(v=>(v/READOUT.transimpedance-plan.lowCurrent)/plan.swing):[];
  const detected=plan.swing>0?readoutDetect(normalized,plan.values.decoder):{levels:[],bits:[],metric:null};
  const bits=detected.bits.slice(0,plan.track.cells),errors=bits.reduce((n,b,i)=>n+Number(b!==plan.track.bits[i]),0);
  const last=Math.min(plan.sampleCount-1,Math.floor(travel)-1),next=Math.min(plan.sampleCount-1,last+1),fraction=travel-Math.floor(travel);
  const interpolate=(xs,before)=>{const a=last<0?before:xs[last];return a+(xs[next]-a)*fraction;};
  const beforeCurrent=plan.lowCurrent+plan.swing;
  return {time:clock,travel,sampleCount,received,normalized,detected,bits,errors,complete:clock>=plan.duration,
    light:interpolate(plan.lightSamples,beforeCurrent/READOUT.responsivity),current:interpolate(plan.currentSamples,beforeCurrent),voltage:interpolate(plan.voltageSamples,beforeCurrent*READOUT.transimpedance),signalPresent:plan.swing>0};
}

export function createReadoutController(initial={}){
  let plan,clock=0,replay;
  function reset(input={}){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['settings','time'].includes(k)))throw new TypeError('Invalid optical readout initial state');
    const next=readoutPlan(input.settings??{}),time=input.time??0;validTime(time);
    if(time>next.duration)throw new RangeError('Readout time exceeds sample');
    plan=next;clock=time;replay={settings:{...plan.values},time};return getState();
  }
  function update(input={}){
    const values=validateControls(input,plan.values,READOUT_DOMAINS,'optical readout');
    if(Object.keys(values).some(k=>values[k]!==plan.values[k]))reset({settings:values});
    return getState();
  }
  function getState(){return {...plan,values:{...plan.values},...readoutAt(plan,clock)};}
  function advance(seconds){validTime(seconds);clock=Math.min(plan.duration,clock+seconds);if(plan.duration-clock<1e-10)clock=plan.duration;return getState();}
  reset(initial);return {getState,update,reset,advance,replayState:()=>({...replay,settings:{...replay.settings}})};
}

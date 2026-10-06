import {validateControls,validTime} from './physics-kit.js';
import {VOWELS,GROUPS,TABLE_II,MEASUREMENTS,formantsOf,resonanceOf,fft,framing,frameFeatures,windowOf,leakageOf} from './speech-physics.js';

export {VOWELS,GROUPS,TABLE_II,MEASUREMENTS};
export const PHONEME_SOUNDS=Object.freeze([...VOWELS.map(v=>Object.freeze({...v,kind:'vowel'})),
  Object.freeze({ipa:'s',word:'sip',kind:'fricative',center:6000,width:2500,voiced:false}),
  Object.freeze({ipa:'z',word:'zip',kind:'fricative',center:6000,width:2500,voiced:true}),
  Object.freeze({ipa:'ʃ',word:'ship',kind:'fricative',center:3500,width:2000,voiced:false}),
]);
export const PHONEME_DEFAULTS=Object.freeze({first:4,second:0,speaker:0,pitch:0,references:0,rate:16,window:0,airflow:1,sound:0});
export const PHONEME_DOMAINS=Object.freeze({first:[0,12,1],second:[0,12,1],speaker:[0,2,1],pitch:[-6,6,6],references:[0,2,1],rate:[8,16,8],window:[0,2,1],airflow:[0,1,1],sound:[0,1,1]});
export const PHONEME_TIMING=Object.freeze({lead:.15,segment:.8,gap:.2,tail:.15,ramp:.015,duration:2.1});
export const PHONEME_BANDWIDTHS=Object.freeze([80,100,150]);

export function phonemeSettings(input={}){return validateControls(input,PHONEME_DEFAULTS,PHONEME_DOMAINS,'phoneme');}

export function phonemeParameters(index,speaker=0,pitch=0){
  phonemeSettings({first:index,speaker,pitch});
  const sound=PHONEME_SOUNDS[index],vowel=sound.kind==='vowel';
  return {index,...sound,speaker:vowel?speaker:null,formants:vowel?formantsOf(speaker,index):[],
    f0:vowel?TABLE_II.f0[speaker][index]*2**(pitch/12):sound.voiced?125*2**(pitch/12):0,pitch};
}

export function phonemeTransfer(parameters,frequency){
  if(!Number.isFinite(frequency)||frequency<0)throw new RangeError('Invalid frequency');
  if(parameters.kind==='fricative')return {re:Math.exp(-.5*((frequency-parameters.center)/(parameters.width/2.355))**2),im:0};
  let re=1,im=0;
  parameters.formants.forEach((f,i)=>{const h=resonanceOf(frequency,f,PHONEME_BANDWIDTHS[i]);[re,im]=[re*h.re-im*h.im,re*h.im+im*h.re];});
  return {re,im};
}

const tokens=new Map();
/** Additive periodic excitation and random-phase noise are band-limited before sampling. */
export function phonemeToken(index,speaker=0,pitch=0,rate=16000){
  if(![8000,16000].includes(rate))throw new RangeError('Invalid sample rate');
  const key=[index,speaker,pitch,rate].join(':'),cached=tokens.get(key);if(cached)return cached;
  const parameters=phonemeParameters(index,speaker,pitch),count=Math.round(rate*PHONEME_TIMING.segment),raw=new Float64Array(count),source=new Float64Array(count),harmonics=[];
  if(parameters.kind==='vowel'){
    for(let k=1;k*parameters.f0<rate/2;k++){
      const frequency=k*parameters.f0,amplitude=2/Math.PI*(k%2?1:-1)/k,h=phonemeTransfer(parameters,frequency);
      harmonics.push({frequency,source:amplitude,re:amplitude*h.re,im:amplitude*h.im});
    }
    for(let n=0;n<count;n++)for(const h of harmonics){const a=2*Math.PI*h.frequency*n/rate;source[n]+=h.source*Math.sin(a);raw[n]+=h.re*Math.sin(a)+h.im*Math.cos(a);}
  }else{
    // 1.024 seconds gives the same frequency grid at both rates. No Nyquist bin.
    const size=rate===16000?16384:8192,re=new Float64Array(size),im=new Float64Array(size),sr=new Float64Array(size),si=new Float64Array(size);
    let seed=0x71a32b4d;
    for(let k=1;k<size/2;k++){
      seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
      const phase=(seed>>>0)/4294967296*2*Math.PI,h=phonemeTransfer(parameters,k*rate/size).re;
      sr[k]=Math.cos(phase);si[k]=Math.sin(phase);sr[size-k]=sr[k];si[size-k]=-si[k];
      re[k]=sr[k]*h;im[k]=si[k]*h;re[size-k]=re[k];im[size-k]=-im[k];
    }
    // Inverse DFT through conjugation; real output has the same real part.
    for(let k=0;k<size;k++){im[k]*=-1;si[k]*=-1;}fft(re,im);fft(sr,si);
    for(let n=0;n<count;n++){raw[n]=re[n]/size;source[n]=sr[n]/size;}
    if(parameters.voiced){
      const rms=Math.sqrt(raw.reduce((s,x)=>s+x*x,0)/count),voice=new Float64Array(count);
      for(let k=1;k*parameters.f0<Math.min(1000,rate/2);k++){
        const amplitude=1/k**2;harmonics.push({frequency:k*parameters.f0,source:amplitude,re:amplitude,im:0});
        for(let n=0;n<count;n++)voice[n]+=amplitude*Math.sin(2*Math.PI*k*parameters.f0*n/rate);
      }
      const voiceRms=Math.sqrt(voice.reduce((s,x)=>s+x*x,0)/count);
      for(let n=0;n<count;n++){const voiced=.75*rms*voice[n]/voiceRms;raw[n]+=voiced;source[n]+=voiced;}
    }
  }
  let peak=0,sourcePeak=0;for(let n=0;n<count;n++){peak=Math.max(peak,Math.abs(raw[n]));sourcePeak=Math.max(sourcePeak,Math.abs(source[n]));}
  const gain=.75/peak,samples=Float64Array.from(raw,(x,n)=>{
    const t=n/rate,remaining=(count-1-n)/rate,ramp=Math.min(1,t/PHONEME_TIMING.ramp,remaining/PHONEME_TIMING.ramp),envelope=.5-.5*Math.cos(Math.PI*ramp);
    return x*gain*envelope;
  });
  const token={parameters,rate,count,raw,source:Float64Array.from(source,x=>x/Math.max(sourcePeak,1e-30)),samples,gain,harmonics};
  if(tokens.size>=128)tokens.clear();tokens.set(key,token);return token;
}

export function vowelReferenceStats(group){
  phonemeSettings({references:group});
  const nearest=(row,g)=>{const distances=VOWELS.map((_,v)=>(row.f1-TABLE_II.f1[g][v])**2+(row.f2-TABLE_II.f2[g][v])**2);return distances.indexOf(Math.min(...distances));};
  return {total:MEASUREMENTS.length,right:MEASUREMENTS.filter(r=>nearest(r,group)===r.vowel).length,
    ownGroup:MEASUREMENTS.filter(r=>nearest(r,r.group)===r.vowel).length,
    children:MEASUREMENTS.filter(r=>r.group===2&&nearest(r,group)===r.vowel).length,childrenTotal:300};
}
const stats=GROUPS.map((_,g)=>vowelReferenceStats(g));

export function phonemeSpectrum(frame,plan){
  if(!frame)return [];
  const sum=plan.window.reduce((a,b)=>a+b,0);
  return Array.from(frame.power,(p,k)=>Math.max(-80,20*Math.log10(Math.max(1e-12,(k===0||k===frame.power.length-1?1:2)*Math.sqrt(p)/sum))));
}

const analyses=new Map();
export function phonemePlan(input={}){
  const values=phonemeSettings(input),key=JSON.stringify(Object.fromEntries(Object.entries(values).filter(([k])=>!['references','sound'].includes(k))));
  let analysis=analyses.get(key);
  if(!analysis){
    const rate=values.rate*1000,tokens=[values.first,values.second].map((i,slot)=>phonemeToken(i,values.speaker,slot?values.pitch:0,rate));
    const starts=[PHONEME_TIMING.lead,PHONEME_TIMING.lead+PHONEME_TIMING.segment+PHONEME_TIMING.gap],samples=new Float64Array(Math.round(PHONEME_TIMING.duration*rate));
    if(values.airflow)tokens.forEach((t,i)=>samples.set(t.samples,Math.round(starts[i]*rate)));
    const frame=framing(rate,samples.length),window=windowOf(values.window,frame.length);
    const frames=Array.from({length:frame.count},(_,i)=>{const start=i*frame.shift,end=start+frame.length,features=frameFeatures(samples,start,rate,values.window);return {index:i,end,...features,rms:Math.sqrt(features.energy/frame.length)};});
    const midFrames=starts.map(t=>Math.round((t+PHONEME_TIMING.segment/2-frame.length/rate/2)*rate/frame.shift));
    const bands=midFrames.map(i=>{
      const power=frames[i].power,total=power.reduce((a,b)=>a+b,0),sum=(low,high,inclusive=true)=>power.reduce((s,p,k)=>{const hz=k*rate/frame.nfft;return s+((inclusive?hz>=low:hz>low)&&hz<high?p:0);},0);
      return {total,low:total?sum(0,1000)/total:0,high:total?sum(4000,8001,false)/total:0,centroid:total?power.reduce((s,p,k)=>s+p*k*rate/frame.nfft,0)/total:null};
    });
    analysis={rate,tokens,starts,samples,frame,window,frames,midFrames,bands,duration:PHONEME_TIMING.duration,leakage:leakageOf(values.window,frame.length,rate)};
    if(analyses.size>=24)analyses.clear();analyses.set(key,analysis);
  }
  return {...analysis,values,analysis,referenceStats:stats[values.references]};
}

export function phonemeAt(plan,time){
  validTime(time);const t=Math.min(time,plan.duration),arrived=Math.min(plan.samples.length,Math.floor(t*plan.rate+1e-7)),complete=t>=plan.duration;
  const framesArrived=arrived<plan.frame.length?0:Math.min(plan.frames.length,1+Math.floor((arrived-plan.frame.length)/plan.frame.shift));
  const active=plan.starts.findIndex(start=>t>=start&&t<start+PHONEME_TIMING.segment),shown=complete?plan.midFrames[1]:framesArrived-1,frame=shown>=0?plan.frames[shown]:null;
  const finished=plan.starts.map(start=>t>=start+PHONEME_TIMING.segment),heard=finished.filter(Boolean).length;
  const names=plan.tokens.map(x=>`[${x.parameters.ipa}]`);
  const status=!plan.values.airflow?(complete?'No airflow: both segments are silent.':'Airflow is off. Play to measure silence.'):
    complete?`${names[0]} → ${names[1]}: compare the frequency patterns.`:
    t===0?`Play ${names[0]}, then ${names[1]}. Optional sound uses these samples.`:
    active<0?'A quiet gap separates the sounds.':`Sound ${active+1}: ${names[active]} · ${plan.tokens[active].parameters.kind==='vowel'?'periodic voice through resonances':plan.tokens[active].parameters.voiced?'noise plus periodic voice':'filtered turbulence noise'}.`;
  return {time:t,duration:plan.duration,values:{...plan.values},arrived,framesArrived,complete,active,shown,frame,finished,heard,status,
    sample:arrived?plan.samples[arrived-1]:0,bandResults:plan.bands.map((b,i)=>finished[i]?b:null)};
}

export function phonemeComparison(plan,state){
  if(!state.complete)return 'Complete both sounds to compare their measured patterns.';
  if(!plan.values.airflow)return 'Both sounds are silent: without airflow this model produces no acoustic energy.';
  const [a,b]=plan.tokens.map(t=>t.parameters),[x,y]=plan.bands;
  if(a.kind==='vowel'&&b.kind==='vowel'){
    if(a.index===b.index)return a.f0===b.f0?`Both [${a.ipa}] segments use the same pitch and formants, so their sustained patterns repeat.`:`Pitch changes ${a.f0.toFixed(1)} → ${b.f0.toFixed(1)} Hz, while all three formant targets stay fixed. Harmonic spacing changes without changing the selected vowel.`;
    return `F1 changes ${a.formants[0]} → ${b.formants[0]} Hz and F2 ${a.formants[1]} → ${b.formants[1]} Hz. ${a.index===9||b.index===9?'The rhotic vowel also has a low F3, near F2.':'The filter favors different harmonics in each vowel.'}`;
  }
  if(a.kind!==b.kind)return `The vowel has periodic harmonics; frication spreads noise across a band. Power above 4 kHz changes ${(100*x.high).toFixed(1)}% → ${(100*y.high).toFixed(1)}% in these frames.`;
  if(a.index===b.index)return a.f0===b.f0?`Both [${a.ipa}] segments use the same assigned source and filter, so their sustained patterns repeat.`:`Periodic source pitch changes ${a.f0.toFixed(1)} → ${b.f0.toFixed(1)} Hz, while the noise filter stays centered at ${a.center} Hz. The low-frequency voice pattern changes.`;
  if(a.voiced!==b.voiced)return `${b.voiced?'Adding':'Removing'} periodic voice changes power below 1 kHz from ${(100*x.low).toFixed(1)}% to ${(100*y.low).toFixed(1)}%, while frication remains. ${a.center===b.center?'The assigned noise filter stays the same.':`The assigned noise-filter center also changes ${a.center} → ${b.center} Hz.`}`;
  return `The noise pattern shifts: spectral centroid ${x.centroid.toFixed(0)} → ${y.centroid.toFixed(0)} Hz. The assigned front-cavity filter changes where noise is strongest.`;
}

export function createPhonemeController(initial={}){
  let plan,time,start;
  function reset(input={}){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['values','time'].includes(k)))throw new TypeError('Expected phoneme starting state');
    const next=phonemePlan(input.values??{}),t=validTime(input.time??0);if(t>next.duration)throw new RangeError('Starting time exceeds experiment');
    plan=next;time=t;start={values:{...next.values,sound:0},time:t};return phonemeAt(plan,time);
  }
  reset(initial);
  return {reset,getState:()=>phonemeAt(plan,time),getPlan:()=>plan,replayState:()=>({values:{...start.values},time:start.time}),
    update(input={}){const values=validateControls(input,plan.values,PHONEME_DOMAINS,'phoneme'),changed=Object.keys(values).some(k=>!['sound','references'].includes(k)&&values[k]!==plan.values[k]);const next=phonemePlan(values);if(changed){time=0;start={values:{...values,sound:0},time:0};}else start.values.references=values.references;plan=next;return phonemeAt(plan,time);},
    advance(seconds){validTime(seconds);time=Math.min(plan.duration,Number((time+seconds).toFixed(12)));return phonemeAt(plan,time);}};
}

import {validateControls, validTime} from './physics-kit.js';
import {frameFeatures, framing, windowOf, melBankOf, leakageOf} from './speech-physics.js';
import {SPEECH_RECORDINGS} from './speech-command-recordings.js';

export const COMMAND_WORDS = Object.freeze(['down', 'go', 'left', 'no', 'right', 'stop', 'up', 'yes']);
export const RECOGNITION_DEFAULTS = Object.freeze({word:6, voice:0, examples:2, noise:0, rate:16, window:0, context:1, application:0, running:0, microphone:1, sound:0, pace:1});
export const RECOGNITION_DOMAINS = Object.freeze({word:[0,7,1], voice:[0,1,1], examples:[0,2,1], noise:[0,40,10], rate:[8,16,8], window:[0,2,1], context:[0,2,1], application:[0,1,1], running:[0,1,1], microphone:[0,1,1], sound:[0,1,1], pace:[.25,1,.25]});
export const RECOGNITION = Object.freeze({rate:16000, peak:.8, frame:.025, shift:.01, activeRms:.015, minimumFrames:3, maximumDistance:3.5, minimumLead:.08, contextWeight:.05, captureStart:.3, decisionDelay:.3, actionTime:.8, tail:.6, firTaps:127, firCutoff:3500});

export function recognitionSettings(input={}) {
  const v=validateControls(input, RECOGNITION_DEFAULTS, RECOGNITION_DOMAINS, 'speech recognition');
  if (![0,10,20,40].includes(v.noise) || ![.25,.5,1].includes(v.pace)) throw new RangeError('Invalid recognition option');
  return v;
}

const recordings=new Map();
export function recordedCommand(word, voice, reference=false) {
  if (!COMMAND_WORDS.includes(word) || ![0,1].includes(voice) || typeof reference!=='boolean') throw new RangeError('Invalid recording');
  const key=`${word}:${voice}:${reference}`;
  if (!recordings.has(key)) {
    const entry=SPEECH_RECORDINGS.find(x=>x.word===word && x.voice===voice && x.reference===reference);
    const bytes=Uint8Array.from(atob(entry.pcm16), x=>x.charCodeAt(0)), view=new DataView(bytes.buffer);
    const pcm=Float64Array.from({length:bytes.length/2}, (_,i)=>view.getInt16(i*2,true)/32768);
    recordings.set(key,pcm);
  }
  return recordings.get(key).slice();
}

export const RECOGNITION_FIR = Object.freeze((()=>{
  const half=(RECOGNITION.firTaps-1)/2, f=RECOGNITION.firCutoff/RECOGNITION.rate;
  const h=Array.from({length:RECOGNITION.firTaps},(_,i)=>{
    const n=i-half, sinc=n===0?2*f:Math.sin(2*Math.PI*f*n)/(Math.PI*n);
    return sinc*(.54-.46*Math.cos(2*Math.PI*i/(RECOGNITION.firTaps-1)));
  });
  const sum=h.reduce((a,b)=>a+b,0);return h.map(x=>x/sum);
})());

/** Offline, centered FIR conversion of the supplied recording. Padding outside the file is zero. */
export function downsampleCommand(samples) {
  const out=new Float64Array(Math.ceil(samples.length/2)), half=(RECOGNITION_FIR.length-1)/2;
  for (let i=0;i<out.length;i++) {
    let sum=0;
    for (let j=0;j<RECOGNITION_FIR.length;j++) { const n=2*i+j-half;if(n>=0 && n<samples.length)sum+=samples[n]*RECOGNITION_FIR[j]; }
    out[i]=sum;
  }
  return out;
}

/** A fixed, zero-mean noise realization with unit RMS, independent of the word label. */
export function commandNoise(length) {
  if (!Number.isInteger(length) || length<2) throw new RangeError('Invalid noise length');
  let seed=0x13579bdf,mean=0,energy=0;
  const out=Float64Array.from({length},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed/4294967296-.5;mean+=x/length;return x;});
  for(let i=0;i<length;i++){out[i]-=mean;energy+=out[i]*out[i]/length;}
  const rms=Math.sqrt(energy);for(let i=0;i<length;i++)out[i]/=rms;
  return out;
}

export function prepareCommand(samples, {rate=16000,noise=0,microphone=1}={}) {
  if (![8000,16000].includes(rate) || ![0,10,20,40].includes(noise) || ![0,1].includes(microphone) || samples.length<400) throw new RangeError('Invalid recording preparation');
  let peak=0;for(const x of samples){if(!Number.isFinite(x))throw new TypeError('Invalid audio sample');peak=Math.max(peak,Math.abs(x));}
  const gain=peak?RECOGNITION.peak/peak:0, clean=Float64Array.from(samples,x=>x*gain);
  const rms=Math.sqrt(clean.reduce((sum,x)=>sum+x*x,0)/clean.length), noiseRms=noise?rms*10**(-noise/20):0;
  const noiseSamples=commandNoise(clean.length), mixed=Float64Array.from(clean,(x,i)=>(x+noiseRms*noiseSamples[i])*microphone);
  const filtered=rate===8000?downsampleCommand(mixed):mixed;
  let clipped=0;
  const codes=Int16Array.from(filtered,x=>{const q=Math.round(x*32768);if(q< -32768 || q>32767)clipped++;return Math.max(-32768,Math.min(32767,q));});
  return {samples:Float64Array.from(codes,x=>x/32768),codes,clean,gain,rms,noiseRms,clipped,rate};
}

export function commandFeatures(samples, rate, windowType=0) {
  if (![8000,16000].includes(rate) || ![0,1,2].includes(windowType) || samples.length<rate*RECOGNITION.frame) throw new RangeError('Invalid feature input');
  const shape=framing(rate,samples.length);
  const frames=Array.from({length:shape.count},(_,index)=>{
    const start=index*shape.shift,features=frameFeatures(samples,start,rate,windowType);
    const rms=Math.sqrt(features.energy/shape.length);
    return {...features,index,end:start+shape.length,rms,active:rms>=RECOGNITION.activeRms};
  });
  const first=frames.findIndex(x=>x.active), last=frames.findLastIndex(x=>x.active);
  return {...shape,frames,first,last,sequence:first<0?[]:frames.slice(first,last+1).map(x=>x.ceps)};
}

export function commandFrameDistance(a,b) {
  let d=0;for(let k=1;k<13;k++)d+=(a[k]-b[k])**2;return d/12;
}

/** Symmetric DTW: diagonal cost 2d, horizontal/vertical cost d; total weight N+M. */
export function commandDtw(input,reference,{path=false}={}) {
  const n=input.length,m=reference.length;
  if (!n || !m) return {distance:null,prefix:[],path:[]};
  let previous=new Float64Array(m+1).fill(Infinity);previous[0]=0;
  const prefix=[],directions=path?new Uint8Array(n*m):null;
  for(let i=1;i<=n;i++) {
    const row=new Float64Array(m+1).fill(Infinity);
    for(let j=1;j<=m;j++) {
      const d=commandFrameDistance(input[i-1],reference[j-1]),choices=[previous[j-1]+2*d,previous[j]+d,row[j-1]+d];
      let which=0;if(choices[1]<choices[which])which=1;if(choices[2]<choices[which])which=2;
      row[j]=choices[which];if(directions)directions[(i-1)*m+j-1]=which;
    }
    prefix.push(Math.sqrt(row[m]/(i+m)));previous=row;
  }
  const alignment=[];
  if(path){let i=n,j=m;while(i>0 && j>0){alignment.push([i-1,j-1]);const d=directions[(i-1)*m+j-1];if(d!==2)i--;if(d!==1)j--; }alignment.reverse();}
  return {distance:prefix.at(-1),prefix,path:alignment};
}

const referenceCache=new Map();
export function commandReferences(rate,windowType) {
  const key=`${rate}:${windowType}`;
  if(!referenceCache.has(key))referenceCache.set(key,COMMAND_WORDS.flatMap(word=>[0,1].map(voice=>{
    const audio=prepareCommand(recordedCommand(word,voice,true),{rate});
    return {word,voice,...commandFeatures(audio.samples,rate,windowType)};
  })));
  return referenceCache.get(key);
}

/** The recognizer receives samples and labeled references, never the example's word label. */
export function analyzeCommand(samples, references, rate, windowType=0) {
  const features=commandFeatures(samples,rate,windowType), {frames,first,last,sequence}=features;
  const matches=references.map(ref=>({word:ref.word,voice:ref.voice,...commandDtw(sequence,ref.sequence)}));
  const history=[];let lastActive=-1,activeCount=0;
  for(const frame of frames) {
    if(frame.active){lastActive=frame.index;activeCount++;}
    const received=first<0 || lastActive<first?0:lastActive-first+1;
    const distances=COMMAND_WORDS.map(word=>{
      const choices=matches.filter(x=>x.word===word && received>0).map(x=>({distance:x.prefix[received-1],voice:x.voice}));
      return choices.length?choices.reduce((a,b)=>b.distance<a.distance?b:a):{distance:null,voice:null};
    });
    history.push({lastActive,received,activeCount,distances});
  }
  return {...features,matches,history,last};
}

/** Assigned two-word context prior, not a trained language model or calibrated probability. */
export function commandCandidates(distances,context=1) {
  if(![0,1,2].includes(context))throw new RangeError('Invalid word context');
  const priors=context===0?[.5,.5]:context===1?[.9,.1]:[.1,.9];
  const candidates=COMMAND_WORDS.flatMap((word,i)=>{
    const match=distances[i];if(match.distance===null)return [];
    return (word==='right'?['right','write']:[word]).map((text,j)=>({word:text,family:word,voice:match.voice,distance:match.distance,prior:word==='right'?priors[j]:1,score:match.distance-RECOGNITION.contextWeight*Math.log(word==='right'?priors[j]:1)}));
  });
  candidates.sort((a,b)=>a.score-b.score || a.word.localeCompare(b.word));
  const best=candidates[0]??null, lead=best?(candidates[1]?.score??best.score)-best.score:null;
  return {candidates,best,lead};
}

const analysisCache=new Map();
export function recognitionPlan(input={}) {
  const values=recognitionSettings(input),rate=values.rate*1000;
  const key=JSON.stringify([values.word,values.voice,values.noise,values.rate,values.window,values.microphone,values.examples]);
  if(!analysisCache.has(key)) {
    const audio=prepareCommand(recordedCommand(COMMAND_WORDS[values.word],values.voice),{rate,noise:values.noise,microphone:values.microphone});
    const refs=commandReferences(rate,values.window).filter(x=>values.examples===2 || x.voice===values.examples);
    const analysis=analyzeCommand(audio.samples,refs,rate,values.window);
    if(analysisCache.size>=12)analysisCache.clear();
    analysisCache.set(key,{audio,analysis,references:refs});
  }
  const round=x=>Number(x.toFixed(12)),core=analysisCache.get(key),captureEnd=round(RECOGNITION.captureStart+core.audio.samples.length/rate),decisionTime=round(captureEnd+RECOGNITION.decisionDelay),actionEnd=round(decisionTime+RECOGNITION.actionTime);
  return {values,rate,...core,captureEnd,decisionTime,actionEnd,duration:round(actionEnd+RECOGNITION.tail),window:windowOf(values.window,core.analysis.length),bank:melBankOf(rate,core.analysis.nfft),leakage:leakageOf(values.window,core.analysis.length,rate)};
}

export function recognitionAt(plan,time) {
  validTime(time);const t=Math.min(time,plan.duration),v=plan.values,a=plan.analysis;
  const samplesArrived=Math.min(plan.audio.samples.length,Math.max(0,Math.floor((t-RECOGNITION.captureStart)*plan.rate+1e-7)));
  const framesArrived=samplesArrived<a.length?0:Math.min(a.count,1+Math.floor((samplesArrived-a.length)/a.shift));
  const history=framesArrived?a.history[framesArrived-1]:null;
  const rankings=history?commandCandidates(history.distances,v.context):{candidates:[],best:null,lead:null};
  const {best,lead}=rankings, decided=t>=plan.decisionTime;
  const enough=!!history && history.activeCount>=RECOGNITION.minimumFrames;
  const accepted=decided && enough && best.distance<=RECOGNITION.maximumDistance && lead>=RECOGNITION.minimumLead-1e-12;
  const word=accepted?best.word:null,stage=t<RECOGNITION.captureStart?'ready':t<plan.captureEnd?'listening':!decided?'choosing':'result';
  const fraction=accepted?Math.max(0,Math.min(1,(t-plan.decisionTime)/RECOGNITION.actionTime)):0;
  const direction={down:[0,-1],left:[-1,0],right:[1,0],up:[0,1]}[word]??[0,0];
  const command=v.application===0 && accepted, position=command?direction.map(x=>x*fraction):[0,0];
  const sampleCode=samplesArrived?plan.audio.codes[samplesArrived-1]:0;
  const frameIndex=framesArrived?decided && history.lastActive>=0?history.lastActive:framesArrived-1:-1;
  const groundTruth=COMMAND_WORDS[v.word], matchesRecording=word===groundTruth || groundTruth==='right' && word==='write';
  const reason=!decided?'Waiting for the complete recording':!enough?'No speech above the assigned level':best.distance>RECOGNITION.maximumDistance?'No close stored example':lead<RECOGNITION.minimumLead?'Candidates too close to choose':'Word selected';
  const action=!command?null:direction.some(x=>x)?'move':word==='go'?'run':word==='stop'?'stop':word==='yes'?'confirm':word==='no'?'cancel':null;
  const running=action==='run'?true:action==='stop'?false:!!v.running;
  const runningTime=v.running?Math.min(t,plan.decisionTime):0;
  const runnerAngle=(runningTime+(running?Math.max(0,t-plan.decisionTime):0))*Math.PI*1.5;
  const status=stage==='ready'?'Ready: play the supplied recording':stage==='listening'?`Listening: ${framesArrived} complete frames`:stage==='choosing'?'Comparing words and context':!accepted?`${reason}; no action`:`Recognized “${word}”${matchesRecording?'':` from the “${groundTruth}” example: a mistake`}${v.application===1?'; written as text':action?`; ${action==='move'?'move '+word:action}`:'; no matching command'}`;
  return {values:{...v},time:t,duration:plan.duration,complete:t>=plan.duration,stage,samplesArrived,framesArrived,frameIndex,frame:frameIndex>=0?a.frames[frameIndex]:null,history,...rankings,decided,accepted,word,reason,groundTruth,matchesRecording,position,fraction,action,running,runnerAngle,dictation:accepted && v.application===1?word:'',sampleCode,sampleBits:(sampleCode&65535).toString(2).padStart(16,'0'),sample:sampleCode/32768,status};
}

export function createRecognitionController(initial={}) {
  let plan,time=0,start;
  const reset=(input={})=>{
    if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).some(k=>k!=='values' && k!=='time'))throw new TypeError('Expected recognition initial state');
    const next=recognitionPlan(input.values??{}),t=input.time??0;validTime(t);if(t>next.duration)throw new RangeError('Invalid initial time');
    plan=next;time=t;start={values:{...next.values,sound:0},time:t};return recognitionAt(plan,time);
  };
  reset(initial);
  return {getState:()=>recognitionAt(plan,time),getPlan:()=>plan,replayState:()=>({values:{...start.values},time:start.time}),reset,
    update(input={}){recognitionSettings(input);const next=recognitionPlan({...plan.values,...input});const changed=Object.keys(input).some(k=>!['sound','pace'].includes(k) && next.values[k]!==plan.values[k]);plan=next;if(changed){time=0;start={values:{...next.values,sound:0},time:0};}else{start.values.pace=next.values.pace;}return recognitionAt(plan,time);},
    advance(seconds){validTime(seconds);time=Math.min(plan.duration,Number((time+seconds).toFixed(12)));return recognitionAt(plan,time);},
  };
}

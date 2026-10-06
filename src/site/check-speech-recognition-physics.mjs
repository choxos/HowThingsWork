import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tally} from './model-check-kit.mjs';
import * as P from './speech-recognition-physics.js';
import {SPEECH_RECORDINGS} from './speech-command-recordings.js';
const t=tally(),D=P.RECOGNITION_DEFAULTS,outcomes=[];
const rms=a=>Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length);
assert.equal(SPEECH_RECORDINGS.length,32);t.add();
for(const word of P.COMMAND_WORDS)for(const voice of [0,1]){
  const a=P.recordedCommand(word,voice),b=P.recordedCommand(word,voice,true);
  t.ok(a.length===16000&&b.length===16000&&rms(a)>0&&rms(b)>0,'Independent nonempty one-second takes');
  assert.notDeepEqual(a,b);a[0]=123;t.ok(P.recordedCommand(word,voice)[0]!==123,'Caller cannot mutate source audio');
}
const noise=P.commandNoise(16000);t.near(noise.reduce((s,x)=>s+x,0)/noise.length,0,1e-14,'Noise is zero mean');t.near(rms(noise),1,1e-14,'Noise is unit RMS');assert.deepEqual(P.commandNoise(16000),noise);t.add();
for(const snr of [10,20,40]){
 const raw=P.recordedCommand('up',0),a=P.prepareCommand(raw,{noise:snr});
 t.near(20*Math.log10(a.rms/a.noiseRms),snr,1e-12,'Assigned prequantization SNR');
 const delta=a.samples.map((x,i)=>x-a.clean[i]);t.near(20*Math.log10(a.rms/rms(delta)),snr,.002,'Measured quantized SNR');
 t.ok(a.clipped===0,'Test input has no hidden clipping');
}
const silence=P.prepareCommand(P.recordedCommand('up',0),{microphone:0,noise:10,rate:8000});t.ok(silence.samples.every(x=>x===0),'Disconnected input remains zero through filtering and noise');
t.near(P.RECOGNITION_FIR.reduce((a,b)=>a+b,0),1,1e-14,'FIR unity DC gain');
for(let i=0;i<127;i++)t.near(P.RECOGNITION_FIR[i],P.RECOGNITION_FIR[126-i],1e-16,'FIR symmetric');
const gain=hz=>Math.hypot(...[Math.cos,Math.sin].map(fn=>P.RECOGNITION_FIR.reduce((s,h,i)=>s+h*fn(2*Math.PI*hz*(i-63)/16000),0)));
t.near(gain(1000),1,.003,'Speech passband retained');t.ok(gain(4000)<.003&&gain(6000)<.003,'Above-Nyquist input attenuated before decimation');
const impulse=new Float64Array(16000);impulse[8000]=1;const decimated=P.downsampleCommand(impulse);
for(let i=0;i<decimated.length;i++){const j=8000-2*i+63;t.near(decimated[i],j>=0&&j<127?P.RECOGNITION_FIR[j]:0,1e-16,'Centered FIR impulse and decimation');}

// Direct defining sums independently verify FFT, filters and cosine features.
let directFrames=0,directBins=0;
for(const rate of [8000,16000])for(const window of [0,1,2]){
 const p=P.recognitionPlan({rate:rate/1000,window}),N=rate*.025,K=rate===16000?512:256;
 for(const frameIndex of [12,43,75]){
  const f=p.analysis.frames[frameIndex],raw=p.audio.samples.slice(frameIndex*rate*.01,frameIndex*rate*.01+N);
  const win=Array.from({length:N},(_,i)=>window===2?1:(window===0?.54:.5)-(window===0?.46:.5)*Math.cos(2*Math.PI*i/(N-1)));
  const power=Array.from({length:K/2+1},(_,k)=>{let re=0,im=0;for(let n=0;n<N;n++){const angle=2*Math.PI*k*n/K;re+=raw[n]*win[n]*Math.cos(angle);im-=raw[n]*win[n]*Math.sin(angle);}return re*re+im*im;});
  power.forEach((x,k)=>{t.near(f.power[k],x,2e-9*Math.max(1,x),'FFT versus direct DFT');directBins++;});
  const low=1127*Math.log1p(20/700),high=1127*Math.log1p(rate/1400),edge=Array.from({length:25},(_,j)=>low+(high-low)*j/24);
  const sums=Array.from({length:23},(_,j)=>power.reduce((sum,pow,k)=>{const mel=1127*Math.log1p(k*rate/K/700),w=Math.max(0,Math.min((mel-edge[j])/(edge[j+1]-edge[j]),(edge[j+2]-mel)/(edge[j+2]-edge[j+1])));return sum+w*pow;},0));
  const logs=sums.map(x=>Math.log(Math.max(x,1e-10)));
  for(let j=0;j<23;j++)t.near(f.mel[j],sums[j],3e-9*Math.max(1,sums[j]),'Independent mel integration');
  for(let k=0;k<13;k++){const c=logs.reduce((sum,x,j)=>sum+x*Math.cos(Math.PI*k*(j+.5)/23),0)*Math.sqrt((k?2:1)/23);t.near(f.ceps[k],c,2e-8,'Independent cosine transform');}
  t.near(f.rms,rms(raw),1e-14,'Activity uses raw frame RMS');directFrames++;
 }
}

// Enumerate every monotone alignment of short sequences, independently of DP.
const feature=x=>Float64Array.from({length:13},(_,k)=>k?x:99);
function exhaustive(a,b,i=0,j=0,cost=0){
 const d=(a[i]-b[j])**2,first=i===0&&j===0,base=cost+(first?2*d:0);
 if(i===a.length-1&&j===b.length-1)return base;
 const choices=[];
 if(i+1<a.length&&j+1<b.length)choices.push(exhaustive(a,b,i+1,j+1,base+2*(a[i+1]-b[j+1])**2));
 if(i+1<a.length)choices.push(exhaustive(a,b,i+1,j,base+(a[i+1]-b[j])**2));
 if(j+1<b.length)choices.push(exhaustive(a,b,i,j+1,base+(a[i]-b[j+1])**2));
 return Math.min(...choices);
}
let paths=0;
for(const n of [1,2,3,4])for(const m of [1,2,3,4])for(let mask=0;mask<2**(n+m);mask++){
 const a=Array.from({length:n},(_,i)=>(mask>>i)&1),b=Array.from({length:m},(_,j)=>(mask>>(j+n))&1),r=P.commandDtw(a.map(feature),b.map(feature),{path:true});
 t.near(r.distance,Math.sqrt(exhaustive(a,b)/(n+m)),1e-14,'DTW global optimum versus exhaustive paths');
 assert.deepEqual(r.path[0],[0,0]);assert.deepEqual(r.path.at(-1),[n-1,m-1]);t.add(2);
 let weighted=2*(a[0]-b[0])**2,weight=2;
 for(let k=1;k<r.path.length;k++){const [i,j]=r.path[k],[x,y]=r.path[k-1],di=i-x,dj=j-y;t.ok(di>=0&&di<=1&&dj>=0&&dj<=1&&di+dj>0,'Valid alignment step');weight+=di+dj;weighted+=(di+dj)*(a[i]-b[j])**2;}
 t.near(weight,n+m,0,'Every path has N+M weight');t.near(r.distance,Math.sqrt(weighted/weight),1e-14,'Returned path has reported distance');paths++;
}
t.ok(P.commandDtw([],[]).distance===null,'Empty input has no match');

// Alter every future input sample. Earlier features and scores must stay exact.
const base=P.recognitionPlan(),cut=6400,changed=base.audio.samples.slice();for(let i=cut;i<changed.length;i++)changed[i]=.7*Math.sin(i);
const alternate=P.analyzeCommand(changed,base.references,16000,0);
for(let i=0;i<base.analysis.count;i++)if(base.analysis.frames[i].end<=cut){assert.deepEqual(alternate.frames[i],base.analysis.frames[i]);assert.deepEqual(alternate.history[i],base.analysis.history[i]);t.add(2);}
for(const time of [0,.3,.324,.325,.335,.699,1.29,1.3,1.599]){const s=P.recognitionAt(base,time);t.ok(!s.accepted&&!s.word&&!s.action&&s.position.every(x=>x===0),'No future decision or command');t.ok(!s.frame||s.frame.end<=s.samplesArrived,'Only complete arrived frame');}
for(const context of [0,1,2]){const s=P.recognitionAt(P.recognitionPlan({word:4,context}),3),right=s.candidates.find(c=>c.word==='right'),write=s.candidates.find(c=>c.word==='write');t.near(right.distance,write.distance,0,'Homophones share all acoustic evidence');t.near(right.score-write.score,context===0?0:context===1?-.05*Math.log(9):.05*Math.log(9),1e-14,'Explicit context penalty');assert.equal(s.word,[null,'right','write'][context]);t.add();}

// All recognition controls interact over the complete finite audio option space.
let acousticCases=0,decisionCases=0,mutedCases=0;
for(let word=0;word<8;word++)for(const voice of [0,1])for(const examples of [0,1,2])for(const noise of [0,10,20,40])for(const rate of [8,16])for(const window of [0,1,2]){
 const values={word,voice,examples,noise,rate,window};const p=P.recognitionPlan(values);acousticCases++;
 for(const context of [0,1,2])for(const application of [0,1])for(const running of [0,1]){
  const plan={...p,values:{...p.values,context,application,running}},s=P.recognitionAt(plan,3);
  t.ok(s.candidates.every(x=>Number.isFinite(x.distance)&&Number.isFinite(x.score)),'Finite candidate distances');
  t.ok(s.accepted===(s.history.activeCount>=3&&s.best.distance<=3.5&&s.lead>=.08-1e-12),'Decision follows stated gate');
  if(application)t.ok(s.action===null&&s.position.every(x=>x===0)&&s.running===!!running,'Dictation leaves application state alone');
  t.ok(!s.accepted?s.word===null&&s.action===null:s.word===s.best.word,'Result reflects inferred word');decisionCases++;
 }
 if(noise===0&&rate===16&&window===0){const s=P.recognitionAt(p,3);outcomes.push({input:P.COMMAND_WORDS[word],voice,examples,word:s.word,best:s.best.word,distance:s.best.distance,lead:s.lead});}
 const silent=P.recognitionAt(P.recognitionPlan({...values,microphone:0}),3);t.ok(!silent.word&&!silent.accepted&&silent.history.activeCount===0,'Every disconnected option gives no recognition');mutedCases++;
}
for(const word of [1,5]){
 const p=P.recognitionPlan({word,running:word===5?1:0}),a=P.recognitionAt(p,1),b=P.recognitionAt(p,1.6),c=P.recognitionAt(p,2);
 t.ok(word===1?a.runnerAngle===0&&c.runnerAngle>0:a.runnerAngle>0&&b.runnerAngle===c.runnerAngle,'Go starts and stop freezes existing motion');
}
const controller=P.createRecognitionController();controller.advance(.75);controller.update({pace:.5,sound:1});t.near(controller.getState().time,.75,0,'Pace and audio preserve time');controller.update({word:4});t.near(controller.getState().time,0,0,'New input restarts');controller.advance(3);controller.reset(controller.replayState());assert.deepEqual(controller.getState().values,{...D,word:4,pace:.5,sound:0});t.add();
for(const bad of [{extra:1},{noise:30},{pace:.75},{word:8},{voice:2},{microphone:2},{rate:12},{window:-1},{examples:NaN},null,[]]){assert.throws(()=>P.recognitionSettings(bad));t.add();}
for(const bad of [null,[],{extra:1},{time:-1},{time:3.01},{values:{noise:30}}]){assert.throws(()=>controller.reset(bad));t.add();}
const report={passed:true,checks:t.count,directFrames,directBins,paths,acousticCases,decisionCases,mutedCases,outcomes};
if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/physics.json',JSON.stringify(report,null,2));}
console.log(`PASS speech recognition physics: ${t.count} checks; ${directFrames} direct transforms; ${paths} exhaustive tiny alignments; ${acousticCases} acoustic options; ${decisionCases} decision contexts; ${mutedCases} disconnected options`);

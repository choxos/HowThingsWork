import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tally} from './model-check-kit.mjs';
import * as P from './phonemes-physics.js';
const t=tally(),D=P.PHONEME_DEFAULTS;
const expectedReferenceStats=[0,1,2].map(P.vowelReferenceStats);
let tokenCases=0,directSamples=0,directBins=0,analysisCases=0,pairCases=0,acousticCombinations=0,controlCombinations=0;
const rms=a=>Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length);

// An independent rational-polynomial evaluation checks all vowel filters.
function transfer(f,formants){
  let re=1,im=0;
  for(let j=0;j<3;j++){
    const w=2*Math.PI*f,w0=2*Math.PI*formants[j],damping=2*Math.PI*[80,100,150][j],a=w0*w0-w*w,b=w*damping,d=a*a+b*b;
    [re,im]=[(re*a+im*b)*w0*w0/d,(im*a-re*b)*w0*w0/d];
  }
  return [re,im];
}
for(let index=0;index<13;index++)for(const speaker of [0,1,2])for(const pitch of [-6,0,6])for(const rate of [8000,16000]){
  const token=P.phonemeToken(index,speaker,pitch,rate),q=token.parameters;tokenCases++;
  t.ok(token.samples.length===rate*.8&&token.samples.every(Number.isFinite),'Finite 800 ms waveform');
  t.ok(Math.max(...token.samples.map(Math.abs))<=.750000001&&rms(token.samples)>.01,'Nonempty bounded waveform');
  t.near(token.samples[0],0,0,'First fade sample is zero');t.near(token.samples.at(-1),0,1e-12,'Last fade sample is zero');
  t.ok(token.harmonics.every(h=>h.frequency<rate/2),'Periodic frequencies strictly below Nyquist');
  if(index<10){
    for(const f of [0,100,270,730,1350,2290,3500,6000]){const [re,im]=transfer(f,q.formants),actual=P.phonemeTransfer(q,f);t.near(actual.re,re,1e-10*Math.max(1,Math.abs(re)),'Independent filter real response');t.near(actual.im,im,1e-10*Math.max(1,Math.abs(im)),'Independent filter imaginary response');}
    for(const n of [0,1,83,327,1023,3160,token.count-1]){
      let raw=0;
      for(let k=1;k*q.f0<rate/2;k++){
        const [re,im]=transfer(k*q.f0,q.formants),a=2*Math.PI*k*q.f0*n/rate;
        raw+=(k%2?1:-1)*2/(Math.PI*k)*(re*Math.sin(a)+im*Math.cos(a));
      }
      t.near(token.raw[n],raw,4e-10*Math.max(1,Math.abs(raw)),'Independent harmonic sample');directSamples++;
    }
  }else{
    const same=P.phonemeToken(index,0,pitch,rate);assert.deepEqual(token.samples,same.samples);t.add();
    if(index!==11){assert.deepEqual(token.samples,P.phonemeToken(index,0,0,rate).samples);t.add();}
  }
}

// Every sound/group/second-pitch/rate/window combination is analyzed. The
// first token stays fixed, so this covers each reusable token's FFT context.
for(let second=0;second<13;second++)for(const speaker of [0,1,2])for(const pitch of [-6,0,6])for(const rate of [8,16])for(const window of [0,1,2]){
  const p=P.phonemePlan({second,speaker,pitch,rate,window}),s=P.phonemeAt(p,3),f=p.frames[p.midFrames[1]];analysisCases++;
  t.ok(s.complete&&s.heard===2&&s.framesArrived===208,'Every option reaches two completed sounds');
  t.ok(f.power.every(x=>Number.isFinite(x)&&x>=0)&&p.bands.every(b=>b.low>=0&&b.low<=1&&b.high>=0&&b.high<=1&&Number.isFinite(b.centroid)),'Finite spectra and physical power fractions');
  const sum=f.power.reduce((a,b)=>a+b,0),weighted=f.power.reduce((a,b,k)=>a+b*k*p.rate/p.frame.nfft,0);t.near(p.bands[1].centroid,weighted/sum,1e-10,'Centroid uses spectral power, not peak position');
  if(second%4===0&&speaker===0&&pitch===0){
    const N=p.frame.length,K=p.frame.nfft,raw=p.samples.slice(f.start,f.end),w=Array.from({length:N},(_,n)=>window===2?1:(window===0?.54:.5)-(window===0?.46:.5)*Math.cos(2*Math.PI*n/(N-1)));
    for(let k=0;k<=K/2;k++){
      let re=0,im=0;for(let n=0;n<N;n++){const a=2*Math.PI*k*n/K;re+=raw[n]*w[n]*Math.cos(a);im-=raw[n]*w[n]*Math.sin(a);}
      t.near(f.power[k],re*re+im*im,1e-9*Math.max(1,re*re+im*im),'FFT matches direct defining sum');directBins++;
    }
  }
}

// All pairs assemble their independent tokens exactly, including repetition.
for(let first=0;first<13;first++)for(let second=0;second<13;second++){
  const p=P.phonemePlan({first,second});pairCases++;
  p.tokens.forEach((token,i)=>assert.deepEqual(p.samples.slice(Math.round(p.starts[i]*p.rate),Math.round(p.starts[i]*p.rate)+token.count),token.samples));t.add(2);
  for(const [a,b]of [[0,.15],[.95,1.15],[1.95,2.1]])t.ok(p.samples.slice(Math.round(a*p.rate),Math.round(b*p.rate)).every(x=>x===0),'Exact quiet lead, gap and tail');
  const silent=P.phonemePlan({first,second,airflow:0});t.ok(silent.samples.every(x=>x===0)&&silent.frames.every(f=>f.power.every(x=>x===0)),'Every sound pair becomes actual silence without airflow');
}
// Visit the complete finite control product, including both non-acoustic
// controls. Independent signal/transform checks above cover its operations.
for(let first=0;first<13;first++)for(let second=0;second<13;second++)for(const speaker of [0,1,2])for(const pitch of [-6,0,6])for(const rate of [8,16])for(const window of [0,1,2])for(const airflow of [0,1]){
 const values={first,second,speaker,pitch,rate,window,airflow},plan=P.phonemePlan(values);acousticCombinations++;
 t.ok(plan.frames.length===208&&plan.samples.length===rate*2100,'Full matrix retains duration and frame count');
 for(let slot=0;slot<2;slot++)for(const n of [0,1,119,501,2117,plan.tokens[slot].count-1])t.near(plan.samples[Math.round(plan.starts[slot]*plan.rate)+n],airflow?plan.tokens[slot].samples[n]:0,0,'Every combination assembles its selected source');
 t.ok(plan.bands.every(b=>airflow?b.total>0&&Number.isFinite(b.centroid):b.total===0&&b.centroid===null),'Silence has no invented centroid in every combination');
 for(const references of [0,1,2])for(const sound of [0,1]){
  const p=P.phonemePlan({...values,references,sound}),s=P.phonemeAt(p,3);controlCombinations++;
  assert.equal(p.analysis,plan.analysis);t.add();t.ok(s.complete&&s.heard===2&&s.values.references===references&&s.values.sound===sound,'Every exposed combination reaches its own valid result');
  t.ok(p.referenceStats.children===expectedReferenceStats[references].children,'Reference selector has its correct independent result');
 }
 if(second===12&&speaker===2&&pitch===6&&rate===16&&window===2&&airflow===1)console.log(`Checked full control product through first sound ${first+1}/13`);
}
const p=P.phonemePlan();
for(const first of [10,11,12])for(const second of [10,11,12])for(const pitch of [-6,0,6]){
 const plan=P.phonemePlan({first,second,pitch}),text=P.phonemeComparison(plan,P.phonemeAt(plan,3));
 if(first===second)t.ok(text.includes(first===11&&pitch!==0?'noise filter stays centered':'patterns repeat'),'Repeated fricatives do not claim a changed filter');
 else if(second===11)t.ok(text.startsWith('Adding periodic voice'),'Forward voicing comparison adds voice');
 else if(first===11)t.ok(text.startsWith('Removing periodic voice'),'Reverse voicing comparison removes voice');
 else t.ok(text.includes('noise pattern shifts'),'Different unvoiced frication bands change the pattern');
 if((first===11&&second===12)||(first===12&&second===11))t.ok(text.includes('center also changes'),'Voicing and place contrast names both changes');
}
for(let n=0;n<=p.samples.length;n+=37){const time=n/p.rate,s=P.phonemeAt(p,time);t.ok(!s.frame||s.frame.end<=s.arrived,'No future frame');t.ok(s.framesArrived===p.frames.filter(f=>f.end<=n).length,'Every and only completed frame revealed');t.ok(s.bandResults.every((b,i)=>b===null||time>=p.starts[i]+.8),'No future comparison');}
for(const time of [0,.024999,.025,.15,.95,1.15,1.95,2.1]){const s=P.phonemeAt(p,time);t.ok(s.arrived<=time*p.rate+1e-6,'Sample arrival boundary');}
const pitch=P.phonemePlan({first:4,second:4,pitch:6});t.near(pitch.tokens[1].parameters.f0/pitch.tokens[0].parameters.f0,Math.SQRT2,1e-14,'Pitch changes only second source');assert.deepEqual(pitch.tokens[0].parameters.formants,pitch.tokens[1].parameters.formants);t.add();
assert.notDeepEqual(pitch.tokens[0].samples,pitch.tokens[1].samples);t.add();
const fric=P.phonemePlan({first:10,second:12}),voiced=P.phonemePlan({first:10,second:11}),narrow=P.phonemePlan({first:10,second:12,rate:8});
t.ok(fric.bands[0].centroid>5500&&fric.bands[1].centroid<4000,'Place contrast shifts spectral energy');t.ok(voiced.bands[0].low<.001&&voiced.bands[1].low>.3,'Voice adds low-frequency energy');t.ok(narrow.bands.every(b=>b.high<.0001),'Narrow rate lacks high-frequency band');
t.near(P.vowelReferenceStats(0).ownGroup,1210,0,'Historical own-group count');t.near(P.vowelReferenceStats(0).children,69,0,'Children compared with men’s means');
const c=P.createPhonemeController();c.advance(.75);c.update({references:2,sound:1});t.near(c.getState().time,.75,0,'Analysis-only settings preserve time');c.update({second:10});t.near(c.getState().time,0,0,'Physical change prepares a new run');c.advance(3);c.reset(c.replayState());assert.deepEqual(c.getState().values,{...D,second:10,references:2,sound:0});t.add();t.near(c.getState().time,0,0,'Replay retains experiment settings');
for(const bad of [null,[],{unknown:1},{first:13},{second:-1},{speaker:3},{pitch:3},{rate:12},{window:3},{airflow:NaN},{sound:2},{references:.5}]){assert.throws(()=>P.phonemeSettings(bad));assert.throws(()=>c.update(bad));t.add(2);}
for(const bad of [null,[],{bad:1},{time:-1},{time:2.2},{time:NaN},{values:{pitch:2}}]){assert.throws(()=>c.reset(bad));t.add();}
for(const time of [-1,NaN,Infinity]){assert.throws(()=>P.phonemeAt(p,time));assert.throws(()=>c.advance(time));t.add(2);}
const report={passed:true,checks:t.count,tokenCases,directSamples,directBins,analysisCases,pairCases,acousticCombinations,controlCombinations,frication:fric.bands,voicing:voiced.bands,limitedBand:narrow.bands};
if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/physics.json',JSON.stringify(report,null,2));}
console.log(`PASS phonemes physics: ${t.count} checks; ${tokenCases} token settings; ${analysisCases} analysis settings; ${pairCases} pairs; ${acousticCombinations} acoustic combinations; ${controlCombinations} complete control combinations; ${directSamples} independent samples; ${directBins} direct DFT bins`);

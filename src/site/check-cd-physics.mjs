import assert from 'node:assert/strict';
import {CD_DEFAULTS,CD_DOMAINS,CD_TIMING,cdSettings,cdOptics,cdSpiral,cdStoredDisc,cdPlan,cdAt,createCdController} from './cd-physics.js';

let checks=0, combinations=0;
const check=(value,label)=>{assert.ok(value,label);checks++;};
const close=(actual,expected,tolerance=1e-9)=>{check(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);};
for(const [phase,intensity] of [[0,0],[1,.25],[2,.5],[3,1]]){
  const optics=cdOptics(phase);close(optics.intensity,intensity);close(optics.depthNm*1.55,780/[4,6,8,2][phase]);
}
close(cdOptics().cellNm,277.6620852422602,1e-9);
close(cdOptics().spotDiameterNm,2114.0944781952744);
const reference=cdSpiral(25,12,0);
close(reference.innerRpm,458.3662361046586);close(reference.outerRpm,197.5716534933873,1e-9);
close(reference.referenceTurns,20625);close(reference.referenceLength,Math.PI*(58**2-25**2)/1.6);

const domains=Object.entries(CD_DOMAINS), settings=[];
function enumerate(i,value){if(i===domains.length){settings.push(value);return;}const [key,[lo,hi,step]]=domains[i];for(let n=lo;n<=hi;n+=step)enumerate(i+1,{...value,[key]:n});}
enumerate(0,{});
for(const values of settings){
  const p=cdPlan(values), initial=cdAt(p,0), final=cdAt(p,p.duration);combinations++;
  check(initial.receivedCells===0&&initial.samplePairs===0&&initial.stats.missingSamples===0,'No future data at start');
  check(final.complete&&final.spiral.radiusMm<=58+1e-9&&final.spiral.startMm>=25-1e-9,'Complete excerpt stays in user-data annulus');
  check(final.spiral.radiusMm>final.spiral.startMm,'Spiral advances outward');
  close(final.spiral.rpm*2*Math.PI*final.spiral.radiusMm/1000/60,values.velocity/10);
  if(!values.laser){check(p.read===null&&final.receivedCells===0&&final.samplePairs===0&&final.output.every(x=>x===0),'Laser off cannot recover data');}
  else {
    check(final.samplePairs===17640,'Exactly 0.4 seconds of stereo PCM');
    check(final.stats.erased===[0,1,256,6272][values.loss],'Every loss option changes received symbols');
    check(final.stats.missingSamples===(values.loss===3?3276:0),'Correctable and unresolved losses stay distinct');
  }
}
check(combinations===19584,'All discrete control combinations');
const disc=cdStoredDisc(0);
for(let content=0;content<3;content++)for(let loss=0;loss<4;loss++){
  const p=cdPlan({content,loss}), {pcm,valid,missingSamples}=p.read.recovered;
  let missing=0;
  for(let ch=0;ch<2;ch++)for(let i=0;i<pcm[ch].length;i++){
    if(valid[ch][i])check(pcm[ch][i]===p.disc.pcm[ch][i],'Every recovered sample agrees with stored PCM');
    else {missing++;check(pcm[ch][i]===0&&p.read.audio[ch][i]===0,'Unresolved samples are explicitly muted');}
    close(p.read.audio[ch][i],pcm[ch][i]/32768,1e-7);
  }
  check(missing===missingSamples,'Missing count is sample validity, not guessed from loss setting');
}
check(!cdStoredDisc(0).channel.bits.every((x,i)=>x===cdStoredDisc(1).channel.bits[i]),'Stored sound changes physical channel pattern');
check(!cdStoredDisc(1).channel.bits.every((x,i)=>x===cdStoredDisc(2).channel.bits[i]),'Chime changes physical channel pattern');

const timeForCells=cells=>cells<=64?cells/16:4+(cells-64)/(disc.channel.bits.length-64)*2;
const p=cdPlan({loss:3});
for(const cells of [0,24,41,57,58,63,64,587,588,111*588,112*588,p.disc.channel.bits.length]){
  const s=cdAt(p,timeForCells(cells));
  check(s.receivedCells===cells,'Timeline displays exactly arrived cells');
  check(s.samplePairs===Math.max(0,Math.floor(cells/588)-111)*6,'CIRC never releases samples before the necessary delayed frames');
  if(cells<58)check(s.decodedSymbols===0,'First data symbol must be complete');
  if(cells===58)check(s.decodedSymbols===1,'First complete EFM data symbol is visible');
}
const onset=cdAt(p,6), sound=cdAt(p,6.1), end=cdAt(p,6.4);
check(onset.readComplete&&onset.listening&&onset.audioTime===0,'Audio waits for actual decoded excerpt');
close(sound.audioTime,.1);check(sound.output[0]===p.read.recovered.pcm[0][sound.sampleIndex]/32768,'Speaker uses recovered samples');
check(!end.listening&&end.output.every(x=>x===0),'Output stops when sound ends');

const a=createCdController({values:{loss:2,content:2}}),b=createCdController({values:{loss:2,content:2}});
a.advance(4.7);for(let i=0;i<470;i++)b.advance(.01);
assert.deepEqual(a.getState(),b.getState());checks++;
const old=a.getState();a.update({phase:2,sound:1});close(a.getState().time,old.time);check(a.getState().values.phase===2,'Optical experiment preserves playback');
check(a.replayState().values.phase===2&&a.replayState().values.sound===0,'Replay retains optical experiment and resets optional sound');
a.update({radius:58});check(a.getState().time===0&&a.getState().spiral.edgeAdjusted,'Outer-radius choice fits excerpt before edge');
for(const bad of [{radius:24},{radius:25.5},{velocity:13.1},{phase:4},{loss:-1},{laser:NaN},{sound:2},{content:3},{extra:0}]){
  const before=a.getState();assert.throws(()=>a.update(bad));assert.deepEqual(a.getState(),before);checks+=2;
}
for(const t of [-1,NaN,Infinity]){assert.throws(()=>a.advance(t));checks++;}
assert.throws(()=>a.reset({time:8}));assert.throws(()=>cdSettings(null));checks+=2;
a.reset({values:CD_DEFAULTS});check(a.getState().time===0&&!a.getState().complete,'Reset restores start');a.advance(100);check(a.getState().complete,'Completion clamps');
console.log(`CD physics: ${checks} checks passed; all ${combinations} control combinations, source-derived references, arrival boundaries, 12 exact PCM/loss cases and controller lifecycle.`);

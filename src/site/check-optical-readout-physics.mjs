import assert from 'node:assert/strict';
import {READOUT,READOUT_DEFAULTS,readoutTrack,readoutTarget,readoutDetect,readoutPlan,readoutAt,createReadoutController} from './optical-readout-physics.js';
const near=(a,b)=>assert(Math.abs(a-b)<1e-10,`${a} != ${b}`);
// Independent exhaustive sequence search checks the dynamic-programming result.
function brute(samples){
  let minimum=Infinity;
  for(let word=0;word<2**samples.length;word++){
    let older=1,previous=1,cost=0;
    for(let i=0;i<samples.length;i++){const bit=(word>>i)&1;cost+=(samples[i]-(older+2*previous+bit)/4)**2;older=previous;previous=bit;}
    minimum=Math.min(minimum,cost);
  }
  return minimum;
}
assert.deepEqual(readoutTrack(0).bits.join(''),'10010100010010000101000100');
assert.deepEqual(readoutTarget([0,0,0,1,1]),[.75,.25,0,.25,.75]);
for(let length=0;length<=9;length++)for(let seed=0;seed<8;seed++){
  const samples=Array.from({length},(_,i)=>.5+.7*Math.sin(i*3.1+seed));
  near(readoutDetect(samples).metric,brute(samples));
}
let combinations=0;
for(const pattern of [0,1])for(let power=0;power<=100;power+=5)for(const blocked of [0,1])for(const noise of [0,1,2])for(const decoder of [0,1]){
  const p=readoutPlan({pattern,power,blocked,noise,decoder}),s=readoutAt(p,p.duration);combinations++;
  assert(s.complete);assert(s.received.every(Number.isFinite));assert(s.light>=0&&s.current>=0);
  if(!power||blocked){assert.equal(s.bits.length,0);assert.equal(s.signalPresent,false);assert.equal(s.current,0);}
  else{assert.equal(s.bits.length,p.track.cells);if(!noise)assert.deepEqual(s.bits,p.track.bits);}
  near(s.current,READOUT.responsivity*s.light);
  for(let n=1;n<=p.sampleCount;n++){const at=readoutAt(p,n/READOUT.cellsPerSecond);near(at.voltage,p.voltageSamples[n-1]);assert.equal(at.sampleCount,n);}
}
const p=readoutPlan({pattern:1,noise:1}),s=readoutAt(p,p.duration),slice=readoutAt(readoutPlan({pattern:1,noise:1,decoder:1}),p.duration);
assert.equal(s.errors,0);assert.equal(slice.errors,2);
assert(readoutAt(readoutPlan({noise:2}),p.duration).errors>0);
// Altering unreceived future samples cannot change the current estimate.
const before=readoutAt(p,3),modified={...p,voltageSamples:p.voltageSamples.map((v,i)=>i<9?v:v+10)};
assert.deepEqual(readoutAt(modified,3).bits,before.bits);
// Detection has no access to the answer. An inverted observed signal changes its output.
const clean=readoutTarget([...readoutTrack(0).levels,1,1]);
assert.notDeepEqual(readoutDetect(clean.map(x=>1-x)).bits,readoutTrack(0).bits);
const c=createReadoutController({settings:{pattern:1,noise:1},time:2});
const replay=c.replayState();c.advance(1);assert.equal(c.getState().time,3);c.update({noise:1});assert.equal(c.getState().time,3);
c.update({power:50});assert.equal(c.getState().time,0);assert.equal(c.getState().values.pattern,1);
c.reset(replay);assert.equal(c.getState().time,2);assert.equal(c.getState().values.power,100);
c.advance(100);assert(c.getState().complete);
for(const values of [{power:101},{power:NaN},{power:3},{noise:3},{unknown:1},null,[]])assert.throws(()=>readoutPlan(values));
for(const time of [-1,Infinity,NaN])assert.throws(()=>readoutAt(p,time));
assert.throws(()=>c.reset({time:100}));assert.throws(()=>c.advance(-1));assert.throws(()=>readoutDetect([NaN]));
assert.deepEqual(readoutPlan().values,READOUT_DEFAULTS);
console.log(`PASS: ${combinations} control combinations; 80 exhaustive sequence checks; causal samples, photodiode conversion, noise outcomes, reset and validation.`);

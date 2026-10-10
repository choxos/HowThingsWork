import assert from 'node:assert/strict';
import {planPositioning, positioningAt, positioningDomains, positioningDefaults} from './three-axis-physics.js';

const axes = ['x','y','z'], home = {x:0,y:0,z:.2}, lead = {x:2*Math.PI*1.2,y:2*Math.PI*1.2,z:2};
let cases=0, samples=0, pulsesWalked=0;
const near=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);

// Find a nearest endpoint by comparing neighboring motor positions.
function nearest(value, axis, divisions) {
  const pitch=lead[axis]/(200*divisions), lower=Math.floor((value-home[axis])/pitch), candidates=[lower,lower+1];
  candidates.sort((a,b)=>Math.abs(home[axis]+a*pitch-value)-Math.abs(home[axis]+b*pitch-value)||b-a);
  return candidates[0];
}

// Invert distance versus time for each pulse, independently of the sampler.
function pulseTime(distance,length,requestedSpeed,acceleration) {
  if(length===0)return 0;
  const peak=Math.min(requestedSpeed,Math.sqrt(length*acceleration)), ramp=peak*peak/(2*acceleration), duration=2*peak/acceleration+(length-2*ramp)/peak;
  if(distance<=ramp)return Math.sqrt(2*distance/acceleration);
  if(distance>=length-ramp)return duration-Math.sqrt(Math.max(0,2*(length-distance)/acceleration));
  return peak/acceleration+(distance-ramp)/peak;
}

function verify(input) {
  const plan=planPositioning(input),v=plan.values,pitch=Object.fromEntries(axes.map(a=>[a,lead[a]/(200*v.microsteps)]));
  let start={...home},actual={...home},startTime=0;
  for(const requested of v.roundTrip?[{x:v.targetX,y:v.targetY,z:v.targetZ},home]:[{x:v.targetX,y:v.targetY,z:v.targetZ}]){
    const endSteps=Object.fromEntries(axes.map(a=>[a,nearest(requested[a],a,v.microsteps)])),startSteps=Object.fromEntries(axes.map(a=>[a,Math.round((start[a]-home[a])/pitch[a])])),end=Object.fromEntries(axes.map(a=>[a,home[a]+endSteps[a]*pitch[a]]));
    const length=Math.hypot(...axes.map(a=>end[a]-start[a])),speed=Math.abs(end.z-start.z)>1e-12?Math.min(v.speed,3*length/Math.abs(end.z-start.z)):v.speed,duration=pulseTime(length,length,speed,v.acceleration);
    for(const fraction of [0,.03,.19,.49,.77,.97,1]){
      const local=duration*fraction,got=positioningAt(plan,startTime+local),expected={};
      for(const a of axes){
        const count=Math.abs(endSteps[a]-startSteps[a]);let lo=0,hi=count;
        while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(pulseTime(length*mid/count,length,speed,v.acceleration)<=local+1e-10)lo=mid;else hi=mid-1;}
        expected[a]=home[a]+(startSteps[a]+Math.sign(endSteps[a]-startSteps[a])*lo)*pitch[a];near(got.drive[a],expected[a]);
        near((got.drive[a]-home[a])/pitch[a],Math.round((got.drive[a]-home[a])/pitch[a]),1e-8);
      }
      let head=actual.x;const count=Math.abs(Math.round((expected.x-start.x)/pitch.x)),direction=Math.sign(expected.x-start.x);
      for(let i=1;i<=count;i++){const pin=start.x+direction*i*pitch.x;if(pin>head)head=pin;if(pin+v.play<head)head=pin+v.play;pulsesWalked++;}
      near(got.position.x,head);near(got.position.y,expected.y);near(got.position.z,expected.z);
      assert(got.gap>=-1e-9&&got.gap<=v.play+1e-9);assert(got.pathSpeed<=v.speed+1e-9);
      if(length>0)assert(got.pathSpeed*Math.abs(end.z-start.z)/length<=3+1e-9);
      for(const a of axes)assert(Math.abs(end[a]-requested[a])<=pitch[a]/2+1e-9);
      samples++;
    }
    const at=positioningAt(plan,startTime+duration);start=end;actual=at.position;startTime+=duration;
  }
  near(plan.duration,startTime);const end=positioningAt(plan,plan.duration);assert(end.complete);near(end.pathSpeed,0);
  assert.deepEqual(positioningAt(plan,plan.duration+100),end);cases++;
}

// Every control value, plus every combination of target boundaries and motion modes.
for(const [key,[min,max,step]]of Object.entries(positioningDomains))for(let i=0;i<=Math.round((max-min)/step);i++)verify({[key]:Number((min+i*step).toFixed(10))});
for(const targetX of [-10,0,10])for(const targetY of [-10,0,10])for(const targetZ of [.2,5,10])for(const speed of [.5,5])for(const acceleration of [1,10])for(const microsteps of [1,16])for(const play of [0,.5])for(const roundTrip of [0,1])verify({targetX,targetY,targetZ,speed,acceleration,microsteps,play,roundTrip});

for(const microsteps of [1,16])for(const play of [0,.1,.5])for(const targetX of [-.1,.1,6]){
  const plan=planPositioning({microsteps,play,targetX,roundTrip:1});
  for(const share of [.2,.5,.8]){
    const previous=positioningAt(plan,plan.duration*share),next=planPositioning({...plan.values,targetX:-6,speed:1},previous.drive,previous.position),start=positioningAt(next,0);
    assert.deepEqual(start.drive,previous.drive);assert.deepEqual(start.position,previous.position);
  }
}

const loose=planPositioning({roundTrip:1,play:.5}),turn=loose.legs[1].startTime,atTurn=positioningAt(loose,turn),afterTurn=positioningAt(loose,turn+.15);
assert(afterTurn.drive.x<atTurn.drive.x);near(afterTurn.position.x,atTurn.position.x);near(positioningAt(loose,loose.duration).position.x,.5);
for(const [key,[min,max,step]]of Object.entries(positioningDomains))for(const value of [NaN,Infinity,-Infinity,min-step,max+step,min+step/3])assert.throws(()=>planPositioning({[key]:value}),RangeError);
for(const time of [-1,NaN,Infinity])assert.throws(()=>positioningAt(loose,time),RangeError);
assert.throws(()=>planPositioning({}, {x:.001,y:0,z:.2}),RangeError);
assert.throws(()=>planPositioning({},home,{x:1,y:0,z:.2}),RangeError);

// Numerical integration of the reported reference speed recovers geometric path length.
for(const speed of [.5,2,5])for(const acceleration of [1,4,10]){
  const plan=planPositioning({speed,acceleration}),n=10000,dt=plan.duration/n;let distance=0;
  for(let i=0;i<n;i++)distance+=positioningAt(plan,(i+.5)*dt).pathSpeed*dt;
  // Two slope changes bound midpoint error by a * dt² / 4.
  near(distance,plan.legs[0].length,acceleration*dt*dt/4+1e-9);
}
const short=planPositioning({...positioningDefaults,targetX:.1,targetY:.1,targetZ:.2,speed:5,acceleration:10});assert(short.legs[0].profile.triangular);assert(short.legs[0].profile.top<2);
console.log(JSON.stringify({passed:true,cases,samples,pulsesWalked,checks:'Independent pulse-time inversion, stepped coupling contact, every control value, 864 boundary combinations, reversal/retarget continuity, invalid inputs and speed integration'},null,2));

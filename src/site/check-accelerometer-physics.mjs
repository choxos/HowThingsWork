import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ACCELEROMETER_DEFAULTS as D,ACCELEROMETER_DOMAINS as domains,accelerometerForce,accelerometerFilter,accelerometerCapacitance,accelerometerPlan,createAccelerometerController} from './accelerometer-physics.js';
let checks=0,poses=0,integrations=0;
const ok=(value,message)=>{checks++;assert.ok(value,message);};
const near=(a,b,tol=1e-10)=>ok(Math.abs(a-b)<=tol,`${a} differs from ${b}`);
const eq=(a,b)=>{checks++;assert.deepEqual(a,b);};

// Independent inverse quaternion transform, including signed and edge-on poses.
for(let roll=-180;roll<=180;roll+=5)for(let pitch=-90;pitch<=90;pitch+=5)for(const support of [0,1,2]){
 const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch*Math.PI/180,0,roll*Math.PI/180,'XYZ'));
 const expected=new THREE.Vector3(0,[1,0,2][support],0).applyQuaternion(q.invert()),actual=accelerometerForce(roll,pitch,support);
 for(const key of ['x','y','z'])near(actual[key],expected[key]);near(Math.hypot(...Object.values(actual)),[1,0,2][support]);poses++;
}
eq(accelerometerForce(0,0,0),{x:0,y:1,z:0});eq(accelerometerForce(180,0,0),{x:0,y:-1,z:0});eq(accelerometerForce(0,90,0),{x:0,y:0,z:1});
for(let i=-300;i<=300;i++){
 const force=i/100,c=accelerometerCapacitance(force),gapNegative=1+c.displacement,gapPositive=1-c.displacement;
 near(c.negative*gapNegative,1);near(c.positive*gapPositive,1);near(c.difference,c.displacement);
 ok(gapNegative>0&&gapPositive>0,'No plate contact');near(c.displacement*force,-.04*force**2);
}
// Numerically integrate the external RC equation independently of its closed form.
for(const capacitor of [0,1,2])for(const frequency of [1,5,20])for(const amplitude of [-2,.5,2]){
 const tau=32000*[.1,.47,4.7][capacitor]*1e-6,dt=1e-5,w=2*Math.PI*frequency;
 let output=0;
 for(let i=0;i<100000;i++){
  const t=i*dt,f=(time,y)=>(amplitude*Math.sin(w*time)-y)/tau;
  const k1=f(t,output),k2=f(t+dt/2,output+dt*k1/2),k3=f(t+dt/2,output+dt*k2/2),k4=f(t+dt,output+dt*k3);
  output+=dt*(k1+2*k2+2*k3+k4)/6;
  if((i+1)%10000===0)near(accelerometerPlan({experiment:2,amplitude,frequency,capacitor},(i+1)*dt*6).filtered.y,output,1e-8);
 }
 integrations++;
}
for(const capacitor of [0,1,2]){
 const f=accelerometerFilter(capacitor,1,5);
 near(f.cutoff*f.tau*2*Math.PI,1);
 near(accelerometerFilter(capacitor,2,5).noiseMg,2*f.noiseMg);
 for(const amplitude of [-2,-1,0,1,2]){
  const start=accelerometerPlan({experiment:1,amplitude,capacitor},.6);near(start.force.y,amplitude);near(start.filtered.y,0);
  const atTau=accelerometerPlan({experiment:1,amplitude,capacitor},(.1+f.tau)*6);near(atTau.filtered.y,amplitude*(1-Math.exp(-1)));
  for(const t of [0,.05,.2,.6,1]){
   const s=accelerometerPlan({experiment:1,amplitude,capacitor},t*6);
   ok(Math.abs(s.filtered.y)<=Math.abs(amplitude)+1e-12,'Step cannot overshoot');near(s.voltage.y,1.5+.3*s.filtered.y);
  }
 }
}
const st=accelerometerPlan({experiment:3},6);near(st.voltage.x,1.175);near(st.voltage.y,2.125);near(st.voltage.z,2.05);eq(st.force,{x:0,y:1,z:0});
for(const axis of [0,1,2])for(const roll of [-180,-90,0,90,180])for(const pitch of [-90,0,90]){
 const s=accelerometerPlan({experiment:3,axis,roll,pitch},6);
 ok(Object.values(s.equivalent).every(n=>Math.abs(n)<3),'Self-test examples stay within declared range');
}
const off=accelerometerPlan({power:0,experiment:3},6);eq(off.voltage,{x:null,y:null,z:null});eq(off.equivalent,off.force);ok(off.blocked,'Power loss blocks readout');
eq(accelerometerPlan({support:1}).force,{x:0,y:0,z:0});eq(accelerometerPlan({support:1}).tiltValid,false);
const c=createAccelerometerController();eq(c.getState().values,D);
c.advance(2);const unchanged=c.getState();c.update({});eq(c.getState(),unchanged);
c.update({capacitor:2});eq(c.getState().clock,0);c.advance(100);eq(c.getState().clock,6);ok(c.getState().complete,'Completion reached');
const origin=c.replayState();origin.settings.power=0;eq(c.replayState().settings.power,1);
c.reset({settings:{experiment:1,capacitor:2},time:1.2});near(c.getState().filtered.y,1-Math.exp(-.1/.1504));
c.reset(c.replayState());eq(c.getState().clock,0);eq(c.getState().values.capacitor,2);
c.update({power:0});c.advance(10);eq(c.getState().clock,0);
for(const [key,[lo,hi,step]]of Object.entries(domains))for(const value of [NaN,Infinity,lo-step,hi+step,lo+step*.5]){
 checks++;assert.throws(()=>c.update({[key]:value}));
}
for(const input of [{unknown:1},null,[],{time:-1},{time:NaN},{settings:{axis:3}}]){checks++;assert.throws(()=>c.reset(input));}
checks++;assert.throws(()=>c.advance(-1));checks++;assert.throws(()=>accelerometerCapacitance(3.01));
console.log(`PASS accelerometer physics: ${checks} checks, ${poses} poses, ${integrations} independent RC integrations`);

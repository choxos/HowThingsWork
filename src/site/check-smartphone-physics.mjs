import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SMARTPHONE_DEFAULTS as D,SMARTPHONE_DOMAINS as domains,SMARTPHONE_DURATIONS as durations,VOICE_STAGES,smartphoneTouch,smartphoneSpecificForce,smartphoneOrientation,smartphoneRotor,createSmartphoneController} from './smartphone-physics.js';
let checks=0,poses=0,touches=0,rotors=0;
const ok=(condition,message)=>{checks++;assert.ok(condition,message);};
const eq=(a,b,message='State agreement')=>{checks++;assert.deepEqual(a,b,message);};
const near=(a,b,tolerance=1e-9,message='Numerical agreement')=>ok(Math.abs(a-b)<=tolerance,`${message}: ${a} versus ${b}`);

// Independent coordinate transform of world support force, including screen-up.
for(let roll=0;roll<=90;roll+=5)for(let pitch=0;pitch<=90;pitch+=5)for(const support of [0,1,2]){
 const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch*Math.PI/180,0,roll*Math.PI/180,'XYZ'));
 const expected=new THREE.Vector3(0,[1,0,2][support],0).applyQuaternion(rotation.invert());
 const force=smartphoneSpecificForce(roll,pitch,support);poses++;
 for(const key of ['x','y','z'])near(force[key],expected[key]);
 near(Math.hypot(...Object.values(force)),[1,0,2][support]);
 for(const previous of [0,1]){
  const out=smartphoneOrientation(force,previous,support);ok([0,1].includes(out.value)&&out.reason.length>10,'Named orientation decision');
  if(support!==0||pitch===90)eq(out.value,previous,'Ambiguous gravity direction preserves history');
 }
}
eq(smartphoneSpecificForce(0,0,0),{x:0,y:1,z:0});
eq(smartphoneSpecificForce(0,90,0),{x:0,y:0,z:1});
eq(smartphoneSpecificForce(90,0,1),{x:0,y:0,z:0});

// Interpolation is deliberately synthetic. Check partitions, endpoints and
// centroid reproduction, without treating these properties as sensor accuracy.
for(let x=0;x<=4;x+=.5)for(let y=0;y<=6;y+=.5){
 const out=smartphoneTouch(x,y);touches++;
 near(out.total,1);eq(out.estimate,{x,y});
 ok(out.changes.length===35&&out.changes.every(n=>n>=0&&n<=1),'Bounded constructed response');
 ok(out.changes.filter(n=>n>0).length<=4,'At most four interpolation corners');
 for(const [i,n]of out.changes.entries())if(n>0)ok(Math.abs(i%5-x)<1&&Math.abs(Math.floor(i/5)-y)<1,'Only local crossings change');
 eq(smartphoneTouch(x,y,false),{changes:Array(35).fill(0),total:0,estimate:null});
}
eq(smartphoneTouch(1.5,2.5).changes.filter(n=>n>0),[.25,.25,.25,.25]);

// Finite differences of the eccentric mass path independently give the
// equal-and-opposite reaction, including angular acceleration during ramps.
const dt=1e-4;
for(const speed of [1,2])for(let step=1;step<80;step++){
 const time=step/20,now=smartphoneRotor(time,speed),before=smartphoneRotor(time-dt,speed),after=smartphoneRotor(time+dt,speed);rotors++;
 near((after.angle-before.angle)/(2*dt),now.omega,2e-7,'Angle derivative gives angular speed');
 near((after.omega-before.omega)/(2*dt),now.alpha,2e-7,'Speed derivative gives angular acceleration');
 for(const key of ['x','y']){
  near(-(after.weight[key]-2*now.weight[key]+before.weight[key])/(dt*dt),now.reaction[key],.001,'Mass acceleration and shaft reaction oppose');
  near((after.body[key]-2*now.body[key]+before.body[key])/(dt*dt),.03*now.reaction[key],.00004,'Illustrative body obeys center-of-mass constraint');
 }
 const centered=smartphoneRotor(time,speed,true);near(centered.relativeForce,0);eq(centered.body,{x:0,y:0});eq(centered.reaction,{x:0,y:0});near(centered.angle,now.angle);
}
for(const speed of [1,2])for(const time of [0,4,100]){
 const out=smartphoneRotor(time,speed);eq(out.running,false);eq(out.body,{x:0,y:0});eq(out.reaction,{x:0,y:0});near(out.omega,0);near(out.alpha,0);
}
near(smartphoneRotor(2,1).relativeForce,1);near(smartphoneRotor(2,2).relativeForce,4);

const c=createSmartphoneController();
eq(c.getState().values,D);eq(c.getState().registered,null);
for(let i=0;i<7;i++){
 eq(c.getState().now.activeRow,i);c.advance(.4);eq(c.getState().now.scannedRows,i+1);
}
eq(c.getState().now.activeRow,-1);eq(c.getState().registered,null);
c.advance(.8);eq(c.getState().clock,3.6);eq(c.getState().registered,{x:2,y:3});ok(c.getState().now.complete,'Touch completes exactly');
c.update({contact:0});eq(c.getState().registered,{x:2,y:3});c.advance(3.6);eq(c.getState().registered,null);
c.reset({settings:{scenario:1,roll:60},time:2.4});eq(c.getState().orientation,1);
c.update({roll:45});c.advance(2.4);eq(c.getState().orientation,1,'Dead band retains landscape');
c.update({roll:0,support:1});c.advance(2.4);eq(c.getState().orientation,1,'Free fall cannot reset to portrait');
c.update({support:0,pitch:90});c.advance(2.4);eq(c.getState().orientation,1,'Flat phone cannot infer an in-plane direction');
c.update({pitch:0,roll:30});c.advance(2.4);eq(c.getState().orientation,0);

// Every exact phase boundary, and many small frame increments, must finish.
for(const scenario of [0,1,2,3]){
 c.reset({settings:{scenario}});
 for(let n=0;n<640;n++)c.advance(.01);
 eq(c.getState().clock,durations[scenario]);ok(c.getState().now.complete,'Finite animation completes without a floating-point extra frame');
}
c.reset({settings:{scenario:3}});
for(let i=0;i<=8;i++){
 eq(c.getState().now.voiceStage,i);eq(c.getState().now.phase,VOICE_STAGES[i]);eq(c.getState().now.voiceDelivered,i===8);c.advance(.8);
}
c.update({network:0});ok(c.getState().now.blocked&&c.getState().now.complete,'Unavailable network is a named completed failure');ok(!c.getState().now.voiceDelivered,'Unavailable path cannot claim delivery');
c.advance(20);eq(c.getState().clock,0);c.update({network:1});eq(c.getState().now.voiceStage,0);
c.advance(1);c.update({power:0});c.advance(20);eq(c.getState().clock,0);ok(!c.getState().now.displayOn&&!c.getState().now.speakerActive&&!c.getState().now.microphoneActive,'Power gates electronics');
c.update({power:1});eq(c.getState().now.voiceStage,0);
c.reset();c.advance(1);c.update({network:0,roll:30});eq(c.getState().clock,1,'Unrelated settings do not restart touch scan');

// Reset and replay preserve explicit state history. Returned snapshots cannot
// mutate the controller, and invalid operations must be atomic.
const start={settings:{scenario:1,roll:60},orientation:0,registered:{x:1,y:2},time:0};
c.reset(start);c.advance(2.4);eq(c.getState().orientation,1);const replay=c.replayState();c.reset(replay);eq(c.getState().orientation,0);eq(c.getState().registered,start.registered);
const leaked=c.getState();leaked.values.roll=90;leaked.registered.x=4;leaked.now.touch.changes[0]=99;eq(c.getState().values.roll,60);eq(c.getState().registered.x,1);ok(c.getState().now.touch.changes[0]<2,'Defensive state snapshots');
for(const [key,[min,max]]of Object.entries(domains))for(const value of [NaN,Infinity,undefined,min-1,max+1]){
 const before=c.getState();assert.throws(()=>c.update({[key]:value}));eq(c.getState(),before,`Rejected ${key} update is atomic`);
}
for(const invalid of [null,[],{settings:null},{settings:{unknown:1}},{orientation:null},{orientation:2},{time:null},{time:-1},{registered:{x:1,y:2,z:3}},{registered:{x:NaN,y:2}},{registered:[]},{unknown:1}]){
 const before=c.getState();assert.throws(()=>c.reset(invalid));eq(c.getState(),before,'Rejected reset is atomic');
}
for(const dt of [-1,NaN,Infinity,undefined]){const before=c.getState();assert.throws(()=>c.advance(dt));eq(c.getState(),before);}
console.log(`PASS smartphone teaching physics: ${checks} checks, ${poses} poses, ${touches} touch positions, ${rotors} rotor derivative cases`);

import assert from 'node:assert/strict';
import * as P from './lightning-physics.js';
import {tally} from './model-check-kit.mjs';
const t=tally(),near=(a,b,message,rel=1e-9)=>t.near(a,b,Math.max(1e-12,Math.abs(b)*rel),message);
function simpson(fn,a,b,n=20000){const h=(b-a)/n;let sum=fn(a)+fn(b);for(let j=1;j<n;j++)sum+=(j%2?4:2)*fn(a+j*h);return sum*h/3;}
const reference=[{tau1:19e-6,tau2:485e-6,k:.93},{tau1:.454e-6,tau2:143e-6,k:.993}];
let independentIntegrals=0;
for(const [index,src]of reference.entries()){
 const raw=t=>t<=0?0:Math.pow(t/src.tau1,10)/(1+Math.pow(t/src.tau1,10))*Math.exp(-t/src.tau2)/src.k;
 let lo=src.tau1,hi=10*src.tau1;
 for(let j=0;j<100;j++){const a=(2*lo+hi)/3,b=(lo+2*hi)/3;if(raw(a)>raw(b))hi=b;else lo=a;}
 const peakTime=(lo+hi)/2,rawPeak=raw(peakTime);
 for(const peak of [25,50,100,200]){
  const plan=P.lightningPlan({stroke:index,peak}),current=x=>peak*1000*raw(x)/rawPeak;
  near(plan.peakTime,peakTime,'Peak time from an independent ternary search',1e-7);near(P.lightningAt(plan,peakTime).current,peak*1000,'Selected peak is the true peak',1e-12);
  for(const x of [.2,.5,1,2,10,100]){const time=x*src.tau1,h=src.tau1*1e-5,s=P.lightningAt(plan,time),derivative=(current(time+h)-current(time-h))/(2*h);near(s.current,current(time),'Independent Heidler function',2e-12);near(s.slope,derivative,'Analytical derivative against central difference',2e-7);near(s.gap,-(3.3422538049298027e-3*current(time)+1e-5*derivative)/2,'Signed route voltage from independently differentiated current',2e-7);}
  const split=20*src.tau1,end=60*src.tau2;
  const charge=simpson(current,0,split)+simpson(current,split,end),specific=simpson(u=>current(u)**2,0,split)+simpson(u=>current(u)**2,split,end);
  near(plan.charge,charge,'Composite Gauss charge against independent Simpson integration',2e-7);near(plan.energy,specific,'Specific energy against independent Simpson integration',2e-7);independentIntegrals+=2;
  const endState=P.lightningAt(plan,.005);t.ok(endState.charge/plan.charge>.9999,'Five-millisecond record captures over 99.99% of charge');
  const single=P.lightningPlan({stroke:index,peak,paths:1});near(single.gapMax,2*plan.gapMax,'Removing one equal route doubles voltage');near(single.copperEnergy,2*plan.copperEnergy,'Removing one equal route doubles total Joule heat');near(single.earthMax,plan.earthMax,'Common ground current does not change with branch count');
  const h=src.tau1*1e-5;
  for(const time of [src.tau1,5*src.tau1]){const s=P.lightningAt(plan,time),derivative=(P.lightningAt(plan,time+h).magneticEnergy-P.lightningAt(plan,time-h).magneticEnergy)/(2*h);near(-s.gap*s.current,s.copperPower+derivative,'Source power into the route equals Joule heating plus change of magnetic energy',1e-6);}
 }
 near(P.currentOf(P.STROKES[index],1,1e100),0,'Very late pulse evaluation remains finite');near(P.slopeOf(P.STROKES[index],1,1e100),0,'Very late derivative remains finite');
}
const slow=P.lightningPlan({peak:50}),fast=P.lightningPlan({peak:50,stroke:1});t.ok(fast.gapMax/slow.gapMax>40&&fast.gapMax/slow.gapMax<42,'Fast equal-peak trial gives about 41 times route voltage');
t.ok(P.lightningAt(slow,100e-6).current>0&&P.lightningAt(slow,100e-6).inductive>0&&P.lightningAt(slow,100e-6).gap>0,'Tail reverses inductive and gap voltage while current magnitude stays positive');
near(P.lightningPlan({peak:200}).charge,100.104191612,'Large slow trial transfers about 100 C',1e-9);

// Integrating shells is independent of the implementation's closed form.
for(const rho of [50,100,1000])for(const radius of [.5,1,2]){
 const shellIntegral=simpson(u=>rho/(2*Math.PI),0,1/radius,1000);near(P.earthResistanceOf(rho,radius),shellIntegral,'Ground resistance by transformed radial shell integration');
 for(const r of [3,5,12]){const current=50e3,delta=simpson(x=>rho*current/(2*Math.PI*x*x),r,r+1,1000);near(P.groundPotentialOf(rho,current,r+1)-P.groundPotentialOf(rho,current,r),delta,'One-meter probe difference integrates the local radial field');}
}
for(const radius of [.5,1,2]){const p=P.lightningPlan({radius});near(p.stepMax,P.lightningPlan().stepMax,'Fixed exterior probes do not depend on contact radius');}
near(P.lightningPlan({distance:3}).stepMax/P.lightningPlan({distance:12}).stepMax,13,'Near and far trial difference ratio');

// Reconstruct potential from an axial line charge, independently of Q1.
function axialIntegral(f,r,z){const radius=Math.max(r,1e-9),a=Math.asinh((z-f)/radius),b=Math.asinh((z+f)/radius);return simpson(u=>z-radius*Math.sinh(u),a,b,2000);}
for(const tip of [.0005,.002,.025]){
 const shape=P.spheroidOf(tip),ambient=10000,strength=ambient*shape.c/axialIntegral(shape.f,0,shape.c);
 const potential=(r,z)=>-ambient*z+strength*axialIntegral(shape.f,r,z);
 for(const [r,z]of [[0,shape.c+tip],[tip,shape.c],[3*tip,shape.c+2*tip],[5*tip,shape.c+10*tip]])near(P.potentialAt(shape,ambient,r,z),potential(r,z),'Potential agrees with independently integrated axial charge',1e-6);
 const h=tip*1e-5;near(P.enhancementOf(shape.c/tip)*ambient,-potential(0,shape.c+h)/h,'Tip enhancement agrees with reconstructed field derivative',3e-4);
 const plan=P.lightningPlan({tip:tip*1000});for(const contour of plan.contours)for(const [x,y]of contour.points)near(P.potentialAt(shape,ambient,Math.abs(x),shape.c+y),-contour.volts,'Every planned contour is its stated equipotential',2e-7);
}
near(P.enhancementOf(1250)*6000,2.30e6,'Published enhancement figure, first point',.005);near(P.enhancementOf(2000)*20000,11.44e6,'Published enhancement figure, second point',.005);
assert.equal(P.lightningPlan({field:0}).contours.length,0);assert.equal(P.lightningPlan({field:0}).tipField,0);assert.ok(!('zone' in P.lightningPlan()));assert.ok(!('flash' in P.lightningPlan()));

// All endpoint combinations, plus intermediate control values and preset states.
let states=0;
const keys=Object.keys(P.LIGHTNING_DOMAINS);
for(let mask=0;mask<2**keys.length;mask++){
 const values=Object.fromEntries(keys.map((k,j)=>[k,P.LIGHTNING_DOMAINS[k][mask>>j&1]])),plan=P.lightningPlan(values);
 for(const time of [0,plan.steepestTime,plan.peakTime,1e-4,.005]){
  const s=P.lightningAt(plan,time);states++;
  t.ok(Object.values(s).every(Number.isFinite),'Every scalar stays finite across all control corners');near(s.leftCurrent+s.rightCurrent,s.current,'KCL at the roof junction');near(s.top,s.earth+s.gap,'Upper conductor potential includes earth and route voltage');t.ok(s.field>=0&&s.step>=0&&s.copperEnergy>=0,'Stress, probe difference and Joule energy are magnitudes');t.ok(s.charge<=plan.charge*(1+1e-10),'Cumulative charge never exceeds full pulse');
 }
}
const controller=P.createLightningController();controller.advance(5.31);const saved=JSON.stringify(controller.getState());controller.update({});assert.equal(JSON.stringify(controller.getState()),saved);
for(const fn of [()=>controller.reset(null),()=>controller.reset({unknown:0}),()=>controller.reset({settings:{peak:50},time:-1}),()=>controller.update({unknown:1}),()=>controller.advance(-1),()=>controller.advance(NaN)]){assert.throws(fn);assert.equal(JSON.stringify(controller.getState()),saved);}
for(const [key,[lo,hi,step]]of Object.entries(P.LIGHTNING_DOMAINS))for(const value of [lo-step,hi+step,lo+step/3,NaN,Infinity])assert.throws(()=>controller.update({[key]:value}));
const external=controller.getPlan();external.values.peak=10;external.samples[0].current=999;assert.equal(JSON.stringify(controller.getState()),saved);
const a=P.createLightningController(),b=P.createLightningController();a.advance(P.RUN);for(const dt of [.03,.7,2.13,.19,10])b.advance(dt);assert.deepEqual(a.getState(),b.getState());
b.reset(b.replayState());assert.equal(b.getState().clock,0);b.advance(3);b.update({peak:50});assert.equal(b.getState().clock,0);assert.equal(b.getState().values.peak,50);
for(const clock of [2.1,3,5,9,P.RUN])near(P.clockOfTime(P.timeOfClock(clock)),clock,'Clock and physical-time mapping invert');
console.log(`PASS lightning physics: ${t.count} checks, ${states} states across 512 control corners, ${independentIntegrals} independent pulse integrals, field reconstruction, KCL and energy balance`);

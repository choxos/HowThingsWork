import assert from 'node:assert/strict';
import {MAGNETIC_ALARM_DEFAULTS as D,MAGNETIC_ALARM_PHYSICS as P,magneticAlarmPull,magneticAlarmThresholds,createMagneticAlarmController} from './magnetic-alarm-physics.js';
let checks=0,combinations=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const near=(a,b,tolerance=1e-9)=>{ok(Math.abs(a-b)<=tolerance*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);};
const controller=createMagneticAlarmController();

// Independent Cartesian dipole field, followed by a central energy derivative.
function fieldSquared(d,h) {
  const r=Math.hypot(d,h),dot=d/r;
  const bx=(3*dot*d/r-1)/r**3,by=3*dot*h/r/r**3;
  return bx*bx+by*by;
}
for(const d of [7,8,11,12,15,16])for(const h of [0,.5,2,6,10,16])for(const m of [.8,1,1.2]) {
  const epsilon=d*1e-5;
  const derivative=(fieldSquared(d-epsilon,h)-fieldSquared(d+epsilon,h))/(2*epsilon);
  near(magneticAlarmPull(d,h,m),derivative*12**7*m*m/24,2e-8);
}
ok(magneticAlarmPull(8,0,1)>magneticAlarmPull(8,8,1),'Offset must weaken horizontal pull.');
assert.throws(()=>magneticAlarmPull(0,0));checks++;
assert.throws(()=>magneticAlarmPull(Infinity,0));checks++;

for(const gap of [8,12,16])for(const magnet of [.8,1,1.2])for(const spring of [.8,1,1.2]) {
  const limits=magneticAlarmThresholds({gap,magnet,spring});
  if(limits.pickup!==null)near(magneticAlarmPull(gap,limits.pickup,magnet),spring);
  if(limits.release!==null)near(magneticAlarmPull(gap-1,limits.release,magnet),spring+.1);
  if(limits.pickup!==null)ok(limits.release>limits.pickup,'The closing and opening stops must have distinct thresholds.');
  const maximumRatio=magneticAlarmPull(gap-1,0,magnet)/spring;
  if(maximumRatio>=1) {
    const derivativeLowerBound=spring/gap*(10/maximumRatio**.2-3);
    ok(derivativeLowerBound>P.springRate,'The continuous interval bound must exclude stable interior equilibria.');
  }
  for(let opening=0;opening<=16;opening+=.25)for(const cable of [0,1])for(const armed of [0,1])for(const power of [0,1])for(const sound of [0,1]) {
    const settings={opening,gap,magnet,spring,cable,armed,power,sound};
    const fresh=controller.reset({settings});
    ok(fresh.closed===(magneticAlarmPull(gap,0,magnet)>=spring-1e-12));
    ok(fresh.alarm===Boolean(power&&armed&&(!fresh.closed||!cable)));
    const atPeak=controller.advance(5);
    near(atPeak.opening,opening);
    near(atPeak.senseCurrent,atPeak.loopClosed&&power?.001:0);
    near(atPeak.senseVoltage,atPeak.loopClosed?0:power*12);
    near(atPeak.sounderCurrent,atPeak.alarm?.1:0);
    const end=controller.advance(5);
    ok(end.complete&&end.opening===0);
    ok(!end.alarm||Boolean(armed&&power));
    if(atPeak.alarm)ok(end.alarm,'Closing the window must retain the alarm.');
    const before=JSON.stringify(end);
    controller.update({});ok(before===JSON.stringify(controller.getState()),'Reading and empty updates cannot change state.');
    const oneStep=controller.reset({settings,clock:10});
    near(oneStep.senseCharge,end.senseCharge);near(oneStep.sounderEnergy,end.sounderEnergy);
    ok(oneStep.closed===end.closed&&oneStep.alarm===end.alarm);
    combinations++;
  }
}

const first=controller.reset();
near(first.senseCurrent,.001);ok(first.closed&&!first.alarm);
const whole=controller.advance(100);
ok(whole.alarm&&whole.closed&&whole.firstTrip?.cause==='contacts');
near(whole.firstTrip.clock,whole.thresholds.release/16*4);
near(whole.sounderEnergy,1.2*(10-whole.firstTrip.clock));
for(const rate of [30,60,144]) {
  controller.reset();for(let i=0;i<10*rate;i++)controller.advance(1/rate);
  const stepped=controller.getState();near(stepped.clock,10);near(stepped.senseCharge,whole.senseCharge);near(stepped.sounderEnergy,whole.sounderEnergy);
  near(stepped.firstTrip.clock,whole.firstTrip.clock);
}
controller.clearAlarm();ok(!controller.getState().alarm,'Closed loop permits clearing.');
controller.update({cable:0});ok(controller.getState().alarm,'A cable break triggers immediately.');
controller.clearAlarm();ok(controller.getState().alarm&&controller.getState().resetBlocked,'Open loop retriggers after clear.');
controller.update({armed:0});ok(!controller.getState().alarm&&!controller.getState().latched);
controller.update({armed:1,power:0});ok(!controller.getState().alarm&&controller.getState().senseCurrent===0);
controller.update({power:1});ok(controller.getState().alarm,'Restoring an armed supply to a broken loop triggers.');
const copy=controller.getState();copy.values.cable=1;copy.thresholds.release=999;copy.firstTrip.clock=-1;
ok(controller.getState().values.cable===0&&controller.getState().firstTrip.clock>=0);
const unchanged=JSON.stringify(controller.getState());
controller.update({gap:9,magnet:NaN,spring:Infinity,cable:'1',power:null});
ok(unchanged===JSON.stringify(controller.getState()));
for(const bad of [NaN,Infinity,-1,0]){controller.advance(bad);ok(unchanged===JSON.stringify(controller.getState()));}
controller.reset({settings:{...D,opening:2}});ok(!controller.advance(10).alarm,'Small motion must remain below release.');
controller.reset({clock:5});const elapsed=controller.getState().clock;controller.update({magnet:1.2});near(controller.getState().clock,elapsed);ok(controller.getState().alarm);
controller.reset(controller.replayState());ok(controller.getState().clock===0&&!controller.getState().alarm);
controller.reset();ok(JSON.stringify(controller.getState().values)===JSON.stringify(D));
console.log(JSON.stringify({status:'PASS',checks,combinations,forceOracle:'Cartesian dipole field energy derivative',histories:'fresh, opening, closing, latched, disarmed, unpowered, clear and retrigger',frameRates:[30,60,144]},null,2));

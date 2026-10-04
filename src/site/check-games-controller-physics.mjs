import assert from 'node:assert/strict';
import {padPlan, padAt, potentiometer, reportBytes, motorAt, threeWaits, latencyOver, debounce, consoleView, SCAN_PHASE_INTERVALS, CLOCKS, STICK, FEEDBACK, RUMBLE_MOTORS, PAD_DOMAINS, POLL_RATES, HISTOGRAM} from './games-controller-physics.js';

let checks = 0;
const ok = (condition, message) => { checks++; assert.ok(condition, message); };
const near = (actual, expected, tolerance, message) => ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${message}: ${actual} versus ${expected}`);

// Independent inclusion-exclusion volume of a box cut by x+y+z < limit.
const boxCDF = (limit, lengths) => {
  if (limit <= 0) return 0;
  if (limit >= lengths.reduce((a,b)=>a+b,0)) return 1;
  let volume = 0;
  for (let mask=0;mask<8;mask++) {
    let corner=0,parity=0;
    for (let j=0;j<3;j++) if(mask&(1<<j)){corner+=lengths[j];parity++;}
    volume += (parity%2?-1:1)*Math.max(0,limit-corner)**3;
  }
  return volume/(6*lengths.reduce((a,b)=>a*b,1));
};
for (const lengths of [[.001,1/60,.0001],[.001,1/60,.0002],[.004,.002,.008],[.001,.001,.001]]) {
  const end=lengths.reduce((a,b)=>a+b,0);
  for(let i=0;i<=300;i++) {
    const x=end*i/300;
    near(threeWaits(x,...lengths),boxCDF(x,lengths),3e-10,'exact three-wait CDF');
    near(threeWaits(x,...lengths)+threeWaits(end-x,...lengths),1,3e-11,'uniform-sum symmetry');
  }
}

// Scan phases form a complete partition. No contact transition may hide inside
// an interval, so its debounced scan indices must stay constant throughout it.
near(SCAN_PHASE_INTERVALS.reduce((sum,[a,b])=>sum+b-a,0),.001,1e-15,'complete scan-phase partition');
for(let n=1;n<=8;n++) for(const [lo,hi] of SCAN_PHASE_INTERVALS) {
  const middle=debounce((lo+hi)/2,n);
  for(const fraction of [.00001,.1,.49,.9,.99999]) assert.deepEqual(debounce(lo+(hi-lo)*fraction,n).changes,middle.changes);
  checks+=5;
}
for(let n=1;n<=8;n++) for(let polling=0;polling<3;polling++) for(let display=0;display<=80;display+=10) {
  const actual=latencyOver(n,polling,display), bins=new Float64Array(HISTOGRAM.bins), P=Math.round(1/POLL_RATES[polling]/.001);
  let mean=0,low=Infinity,high=-Infinity;
  for(const [a,b] of SCAN_PHASE_INTERVALS) for(let offset=0;offset<P;offset++) {
    const events=debounce((a+b)/2,n),view=consoleView(events.changes,offset,P),weight=(b-a)/(.001*P);
    const base=a+view.first*.001+1/60+display/1000, spans=[b-a,.001,1/60];
    mean+=weight*(base+spans.reduce((x,y)=>x+y,0)/2);low=Math.min(low,base);high=Math.max(high,base+spans.reduce((x,y)=>x+y,0));
    for(let bin=0;bin<bins.length;bin++) bins[bin]+=weight*(boxCDF((bin+1)*.002-base,spans)-boxCDF(bin*.002-base,spans));
  }
  near(actual.mean,mean,1e-13,'latency mean by independent volume mixture');
  near(actual.min,low,1e-14,'true lower support bound'); near(actual.max,high,1e-14,'true upper support bound');
  near(actual.histogram.reduce((a,b)=>a+b,0),1,1e-12,'histogram includes every timing');
  actual.histogram.forEach((p,i)=>{ok(p>=-1e-14,'nonnegative probability');near(p,bins[i],4e-10,'latency bin by independent volume mixture');});
}

for(let i=-230;i<=230;i++) {
  const angle=i/230*STICK.travel,p=potentiometer(angle);
  near(p.lower+p.upper,10000,1e-10,'constant potentiometer track resistance');
  near(p.current,.00033,1e-15,'constant track current');
  near(p.current*p.lower,p.volts,1e-14,'wiper voltage by Ohm law');
  ok(p.lower>=999.999999 && p.upper>=999.999999,'travel stays within middle 80 percent');
}
const signed = (low,high) => {const n=low+256*high;return n>=32768?n-65536:n;};
for(const x of [-32768,-32767,-3880,-1,0,1,7160,32767]) for(const y of [-32768,-1,0,1,32767]) for(const pressed of [false,true]) {
  const bytes=reportBytes([x,y],pressed);
  near(signed(bytes[0],bytes[1]),x,0,'signed X little-endian report roundtrip');near(signed(bytes[2],bytes[3]),y,0,'signed Y report roundtrip');
  near(bytes[4],Number(pressed),0,'button report bit');ok(bytes.every(b=>Number.isInteger(b)&&b>=0&&b<256),'five valid bytes');
}

const end=FEEDBACK.rise+FEEDBACK.hold+FEEDBACK.fall;
for(const motor of RUMBLE_MOTORS) {
  near(motor.mass,Math.PI*motor.radius**2*motor.length*8800,1e-16,'mass from weight volume and assigned density');
  const position=time=>{const s=motorAt(motor,time);return [motor.eccentricity*Math.cos(s.angle),motor.eccentricity*Math.sin(s.angle)];};
  for(let i=1;i<900;i++) {
    const time=end*i/900,s=motorAt(motor,time),h=1e-7,a=motorAt(motor,time-h),b=motorAt(motor,time+h);
    near(s.speed,(b.angle-a.angle)/(2*h),1e-6,'angle derivative matches speed');
    const smooth = [0,FEEDBACK.rise,FEEDBACK.rise+FEEDBACK.hold,end].every(boundary=>Math.abs(time-boundary)>h);
    if (smooth) near(s.acceleration,(b.speed-a.speed)/(2*h),1e-4,'speed derivative matches acceleration');
    const p=position(time),pm=position(time-h),pp=position(time+h);
    if (smooth) for(let j=0;j<2;j++) near(s.force[j+1],-motor.mass*(pp[j]-2*p[j]+pm[j])/(h*h),1e-5,'mount reaction from independently differentiated mass position');
    near(s.magnitude,Math.hypot(...s.force),1e-14,'force vector magnitude');
    ok(s.speed>=0&&s.speed<=2*Math.PI*motor.frequency+1e-10,'speed stays within assigned response');
    const off=motorAt(motor,time,false);ok(off.speed===0&&off.angle===0&&off.magnitude===0,'disabled motor stays still');
  }
  for(const time of [0,FEEDBACK.rise,FEEDBACK.rise+FEEDBACK.hold,end]) {
    const a=motorAt(motor,time-1e-10),b=motorAt(motor,time+1e-10);
    near(a.angle,b.angle,2e-7,'continuous motor angle at boundaries');near(a.speed,b.speed,1e-5,'continuous motor speed');near(a.magnitude,b.magnitude,1e-6,'continuous mount force');
  }
  near(motorAt(motor,FEEDBACK.rise+.01).radial,motor.mass*motor.eccentricity*(2*Math.PI*motor.frequency)**2,1e-14,'steady force m r omega squared');
  near(motorAt(motor,end+.01).speed,0,0,'braking brings motor to rest');
}
console.log(`Exact timing, circuits, reports and motor checks: ${checks}`);

// Every offered discrete setting combination. Check the complete causal chain
// at readiness, the feedback pulse and the end of the observation window.
let combinations=0;
const entries=Object.entries(PAD_DOMAINS),visit=(values,index)=>{
  if(index<entries.length){const[key,[lo,hi,step]]=entries[index];for(let v=lo;v<=hi;v+=step)visit({...values,[key]:v},index+1);return;}
  const plan=padPlan(values),ready=padAt(plan,CLOCKS.start),active=padAt(plan,plan.press.frame+FEEDBACK.transfer+.03),done=padAt(plan,CLOCKS.duration);
  ok(ready.heard===0&&ready.onScreen===0&&!ready.firmware,'ready before physical press');
  ok(plan.press.t<=plan.press.registered&&plan.press.registered<=plan.press.reported&&plan.press.reported<=plan.press.frame&&plan.press.frame<plan.press.photon,'causal event ordering');
  ok(done.onScreen===plan.press.presses&&done.onScreen>=1&&done.onScreen<=2,'every observed press reaches screen');
  ok(done.stick.moving===false&&done.motors.every(m=>m.speed===0),'stick and feedback settled by observation end');
  ok(done.firmware&&done.buttonVolts===0,'button remains held at observation end');
  near(signed(done.packet[0],done.packet[1]),done.report.report[0],0,'final packet matches actual last poll');
  near(signed(done.packet[2],done.packet[3]),done.report.report[1],0,'final packet Y matches last poll');
  for(let i=0;i<2;i++) near(active.motors[i].frequency,values.rumble?RUMBLE_MOTORS[i].frequency:0,1e-10,'rumble control changes both actual motor speeds');
  const speed=done.frame.mapped.normalized*5;
  ok(speed>=0&&speed<=5+1e-12,'dead-zone output never exceeds game speed');
  if(values.release===2&&values.deadzone===20)ok(speed>0,'small dead zone allows assigned released-stick creep');
  ok(plan.frames.every(f=>f.scanned<=f.polled+1e-12&&f.polled<=f.t+1e-12&&f.shown>f.t),'every frame uses earlier input and is displayed later');
  combinations++;
};
visit({},0);
assert.equal(combinations,163296);
for(const invalid of [NaN,Infinity,-Infinity]) assert.throws(()=>padAt(padPlan(),invalid),RangeError);
console.log(`PASS controller physics: ${checks} checks, ${combinations} complete control combinations.`);

import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as P from './burglar-alarm-physics.js';
const C=P.BURGLAR_SCIENCE;
let checks=0;const observed={};
const near=(a,b,absolute,label)=>{checks++;assert.ok(Math.abs(a-b)<=absolute,`${label}: ${a} vs ${b}; tolerance ${absolute}`);};
const ok=(value,label)=>{checks++;assert.ok(value,label);};
const simpson=(fn,a,b,n)=>{const h=(b-a)/n;let sum=0;for(let i=0;i<=n;i++)sum+=(i===0||i===n?1:i%2?4:2)*fn(a+i*h);return sum*h/3;};
const v=input=>({...P.BURGLAR_DEFAULTS,...input});

// Independently differentiate Cartesian paths and round-trip phase.
for(const mode of [0,1,2])for(const speed of [.1,1,6])for(const range of [1,5,10])for(const route of [0,1,2,3]){
  const values=v({mode,path:route,speed,range}),start=P.burglarMotion(values,0),time=.5+Math.min(.2,(start.stop-.5)/3),dt=1e-6;
  const a=P.burglarMotion(values,time-dt),b=P.burglarMotion(values,time+dt),now=P.burglarMotion(values,time);
  near((b.x-a.x)/(2*dt),now.vx,2e-8,'Cartesian x velocity');near((b.z-a.z)/(2*dt),now.vz,2e-8,'Cartesian z velocity');
  near((b.distance-a.distance)/(2*dt),now.radial,2e-8,'radial derivative');near(Math.hypot(now.vx,now.vz),speed,1e-12,'speed magnitude');
  const stopped=P.burglarMotion(values,start.stop+.1);near(stopped.speed,0,0,'speed after endpoint');near(stopped.radial,0,0,'radial speed after endpoint');
  if(mode===0){
    const s=P.burglarRadar(values,time),before=P.burglarRadar(values,time-dt),after=P.burglarRadar(values,time+dt);
    near((after.phase-before.phase)/(4*Math.PI*dt),s.doppler,3e-6,'phase derivative gives signed Doppler');
    // A complex return phasor also encodes the same signed frequency.
    const i0=before.i-.6,q0=before.q-.2,i1=after.i-.6,q1=after.q-.2;
    near(Math.atan2(i0*q1-q0*i1,i0*i1+q0*q1)/(4*Math.PI*dt),s.doppler,3e-6,'quadrature phase rotation');
  }
}
near(P.BURGLAR_WAVELENGTH,299792458/24.125e9,0,'SI carrier wavelength');
near(P.burglarRadar(v(),1).doppler,2*24.125e9/299792458,1e-10,'approaching 1 m/s');
near(P.burglarRadar(v({path:1}),1).doppler,-2*24.125e9/299792458,1e-10,'receding 1 m/s');
near(P.burglarRadar(v({path:2}),2.5).doppler,0,0,'cross-path instantaneous tangent');
ok(P.burglarRadar(v({path:2}),1).doppler>0&&P.burglarRadar(v({path:2}),4).doppler<0,'cross-path changes sign');

// Integrate Planck spectral radiance directly, independently of the production series.
const spectral=(lambda,T)=>2*6.62607015e-34*299792458**2/lambda**5/Math.expm1(6.62607015e-34*299792458/(lambda*1.380649e-23*T));
for(const temp of [298.15,302.15,310.15,316.15]){
  const integral=Math.PI*simpson(x=>spectral(x,temp),5e-6,14e-6,12000);
  near(P.burglarExitance(temp),integral,integral*8e-10,'Planck band integration');
}

// Direct 2D Simpson integration of the projected solid angle kernel.
for(const z of [1,5,10])for(const x of [-.8,0,.2,5])for(const width of [.01,.25,.8]){
  const x0=x,x1=x+width,y0=-.35,y1=.35;
  const integral=simpson(u=>simpson(w=>z*z/(z*z+u*u+w*w)**2,y0,y1,120),x0,x1,120);
  near(P.burglarProjectedAngle(x0,x1,y0,y1,z),integral,Math.abs(integral)*3e-9+1e-14,'projected rectangle integral');
}
for(const depth of [1,5,10])for(const s of P.BURGLAR_LENSLETS)for(const element of [0,1]){
  const field=P.burglarZone(s,element,depth),lo=element===0?-.0015:.0005,hi=lo+.001;
  near(s-.0125*(field.x0-s)/depth,hi,1e-17,'left field boundary lands at right element edge');
  near(s-.0125*(field.x1-s)/depth,lo,1e-17,'right field boundary lands at left element edge');
  near(.0125*field.y/depth,.001,1e-17,'vertical field edge');
}
for(const range of [1,5,10])for(const balance of [0,1,10]){
  const p=P.burglarPIR(v({mode:2,speed:0,contrast:0,warming:30,balance,range}),12);
  near(p.plus-p.minus,0,2e-21,'optical power unaffected by responsivity mismatch');
  near(p.responsePlus-p.responseMinus,p.shared*balance/100,2e-21,'common warming and specified response imbalance');
  near(p.radiance,0,0,'zero contrast remains zero');
}

// Separate RK4 state equation for low-pass temperature then electrical high-pass.
// theta'= (p-theta)/thermal; low'= (theta-low)/electrical; output = gain*(theta-low).
function rk4(fn,state,time,dt){
  const a=fn(time,state),b=fn(time+dt/2,state.map((x,i)=>x+a[i]*dt/2)),c=fn(time+dt/2,state.map((x,i)=>x+b[i]*dt/2)),d=fn(time+dt,state.map((x,i)=>x+c[i]*dt));
  return state.map((x,i)=>x+dt*(a[i]+2*b[i]+2*c[i]+d[i])/6);
}
const odeCases=[{mode:2},{mode:2,speed:3,range:2,contrast:8},{mode:2,speed:0},{mode:2,speed:0,contrast:0,warming:30,balance:10}];
observed.pir=[];
for(const input of odeCases){
  const values=v(input),plan=P.burglarPlan(values),f=t=>{const p=P.burglarPIR(values,t);return p.plus*(1+values.balance/200)-p.minus*(1-values.balance/200);},first=f(0);
  const gain=4200/(2*Math.PI/Math.hypot(1,2*Math.PI)/Math.hypot(1,.2*Math.PI));
  let state=[first,first],maxError=0,peak=0;
  const dt=.00025,n=Math.round(12/dt),fn=(time,s)=>[(f(time)-s[0])/.1,(s[0]-s[1])/1];
  for(let k=1;k<=n;k++){
    state=rk4(fn,state,(k-1)*dt,dt);
    if(k%100===0){const exact=gain*(state[0]-state[1]),actual=P.burglarAt(plan,k*dt).output;maxError=Math.max(maxError,Math.abs(exact-actual));peak=Math.max(peak,Math.abs(exact));}
  }
  near(maxError,0,Math.max(2e-10,peak*3e-4),'independent thermal/electrical ODE');observed.pir.push({input,peak,maxError,alarmAt:plan.alarmAt});
}

// Known sinusoid gain of the physical two-pole response, using a long settled run.
for(const frequency of [.1,1,10,160,965.5]){
  const fast=frequency<20?.1:1/(2*Math.PI*1000),slow=frequency<20?1:1/(2*Math.PI*2),dt=frequency<20?1e-4:1/16000;
  let p=0,a=0,b=0,max=0;
  const total=frequency<20?100:3,start=total-(frequency<20?20:1);
  for(let k=1;k<=Math.round(total/dt);k++){const time=k*dt,q=Math.sin(2*Math.PI*frequency*time);a=P.burglarLag(a,p,q,dt,fast);b=P.burglarLag(b,p,q,dt,slow);p=q;if(time>start)max=Math.max(max,Math.abs(slow/(slow-fast)*(a-b)));}
  const expected=2*Math.PI*frequency*slow/Math.hypot(1,2*Math.PI*frequency*slow)/Math.hypot(1,2*Math.PI*frequency*fast);
  near(max,expected,expected*(frequency>900?.013:.002),'known sinusoidal band-pass gain');
}

// All beam control combinations. Analytic blockage, arming delay, and timer edges.
let beamCases=0;
for(let k=0;k<=60;k++)for(let span=5;span<=30;span++)for(const hold of [50,100,250,500])for(const power of [0,1]){
  const speed=k/10,values=v({mode:1,speed,span,hold,power}),plan=P.burglarPlan(values),duration=speed? .25/speed:4;
  const expected=power&&duration+1e-12>=hold/1000;
  ok((plan.alarmAt!==null)===!!expected,'beam timer result');
  near(plan.current,power*.17*60e-6/(10*span*span),1e-22,'beam radiometry');
  if(expected){const start=speed?.5+.375/speed:0;near(plan.alarmAt,start+hold/1000,1e-12,'first qualified beam blockage');ok(!P.burglarAt(plan,plan.alarmAt-1e-7).active,'no early alarm');ok(P.burglarAt(plan,plan.alarmAt).active,'alarm at threshold');}
  beamCases++;
}
observed.beamCases=beamCases;

observed.radar=[];
for(const input of [{},{path:1},{path:2},{path:3},{speed:0},{speed:6,range:1},{speed:.1,range:10},{power:0}]){
  const plan=P.burglarPlan(input),half=P.burglarPlan(input,{step:1/32000});let maxDifference=0,peak=0;
  for(let i=0;i<=240;i++){const time=plan.duration*i/240,a=P.burglarAt(plan,time),b=P.burglarAt(half,time);maxDifference=Math.max(maxDifference,Math.abs(a.level-b.level));peak=Math.max(peak,b.level);}
  near(maxDifference,0,Math.max(1e-12,peak*.012),'Doppler integration convergence');
  if(input.path===3||input.speed===0||input.power===0)ok(plan.alarmAt===null,'unchanging or unpowered radar quiet');
  else ok(plan.alarmAt!==null,'moving radial target detected');
  if(plan.alarmAt!==null)near(plan.alarmAt,half.alarmAt,.00025,'radar confirmation convergence');
  observed.radar.push({input,maxDifference,peak,alarmAt:plan.alarmAt});
}
// Independently integrate the actual cascade and energy state using RK4.
observed.radarODE=[];
for(const input of [{},{path:1},{speed:6,range:1}]){
  const values=v(input),plan=P.burglarPlan(values),fast=1/(2*Math.PI*1000),slow=1/(2*Math.PI*2);
  const raw=t=>{const travel=Math.max(0,Math.min(2,values.speed*(t-.5))),range=values.path===1?values.range+travel:values.range+2-travel,phase=-4*Math.PI*range/(299792458/24.125e9),amp=25/(range*range);return [amp*Math.cos(phase)+.6,amp*Math.sin(phase)+.2];};
  const first=raw(0),n=Math.ceil(plan.duration*128000),dt=plan.duration/n;
  const fn=(time,state)=>{const [i,q]=raw(time),a=state[0]-state[1],b=state[2]-state[3];return [(i-state[0])/fast,(state[0]-state[1])/slow,(q-state[2])/fast,(state[2]-state[3])/slow,(a*a+b*b-state[4])/.01];};
  let state=[first[0],first[0],first[1],first[1],0],peak=0,maxError=0,firstAbove=null,alarm=null;
  for(let k=1;k<=n;k++){
    const time=k*dt;state=rk4(fn,state,time-dt,dt);const level=Math.sqrt(Math.max(0,state[4]));
    if(level>=.08){firstAbove??=time;if(alarm===null&&time-firstAbove>=.05)alarm=time;}else firstAbove=null;
    if(k%512===0){peak=Math.max(peak,level);maxError=Math.max(maxError,Math.abs(P.burglarAt(plan,time).level-level));}
  }
  near(maxError,0,peak*.01,'Independent radar cascade and energy ODE');near(plan.alarmAt,alarm,.00025,'Independent Doppler confirmation time');observed.radarODE.push({input,peak,maxError,alarm});
}

const controller=P.createBurglarController();controller.advance(1);const before=controller.getState();controller.update({pace:.5,sound:1});near(controller.getState().time,before.time,0,'pace/sound preserve clock');
controller.reset({settings:v({path:1,speed:2})});controller.advance(1000);ok(controller.getState().complete,'completion');controller.reset(controller.replayState());near(controller.getState().time,0,0,'replay restarts');near(controller.getState().values.path,1,0,'replay keeps selected path');
for(const bad of [{speed:NaN},{speed:6.1},{hold:150},{balance:2},{pace:.75},{mode:3},{rogue:0}]){checks++;assert.throws(()=>P.burglarPlan(bad));}
for(const bad of [-1,Infinity,NaN]){checks++;assert.throws(()=>P.burglarAt(P.burglarPlan(),bad));}
const report={passed:true,checks,...observed};
if(process.env.EVIDENCE_DIR){fs.mkdirSync(process.env.EVIDENCE_DIR,{recursive:true});fs.writeFileSync(process.env.EVIDENCE_DIR+'/physics.json',JSON.stringify(report,null,2)+'\n');}console.log(`PASS burglar alarm physics: ${checks} checks; ${beamCases} beam cases; independent Planck, projected geometry, PIR and radar ODEs`);

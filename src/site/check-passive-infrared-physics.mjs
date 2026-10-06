import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {PIR_DEFAULTS as D,PIR_DOMAINS,pirPlan,pirAt,pirSettings,pirSharedSettings} from './passive-infrared-physics.js';
import {burglarExitance,burglarProjectedAngle,burglarPIR,burglarZone,BURGLAR_LENSLETS} from './burglar-alarm-physics.js';
import {reviewedPassiveInfraredLesson as lesson} from './passive-infrared-lesson.js';
let checks=0;
const near=(a,b,tolerance,label)=>{checks++;assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tolerance,`${label}: ${a} vs ${b}, tolerance ${tolerance}`);};
const simpson=(f,a,b,n)=>{const h=(b-a)/n;let sum=0;for(let i=0;i<=n;i++)sum+=(i===0||i===n?1:i%2?4:2)*f(a+i*h);return sum*h/3;};
const spectral=(lambda,T)=>2*6.62607015e-34*299792458**2/lambda**5/Math.expm1(6.62607015e-34*299792458/(lambda*1.380649e-23*T));

// Integrate the spectrum directly across every selectable final temperature.
const temperatures=new Set();
for(let contrast=0;contrast<=24;contrast++)for(let warming=0;warming<=30;warming++)temperatures.add((298.15+contrast/2+warming/5).toFixed(2));
for(const T of temperatures){const direct=Math.PI*simpson(w=>spectral(w,Number(T)),5e-6,14e-6,1000);near(burglarExitance(Number(T)),direct,direct*2e-10,'Independent spectral integration');}

// Independently invert image-plane edges and integrate projected source rectangles.
let fields=0;
for(let range=1;range<=10;range+=.5)for(const lenslet of BURGLAR_LENSLETS)for(const element of [0,1]){
  const imageLo=element?.0005:-.0015,imageHi=imageLo+.001;
  const left=lenslet+(lenslet-imageHi)*range/.0125,right=lenslet+(lenslet-imageLo)*range/.0125;
  const field=burglarZone(lenslet,element,range);
  near(field.x0,left,1e-14,'Image inversion left edge');near(field.x1,right,1e-14,'Image inversion right edge');near(field.x1-field.x0,range*.001/.0125,1e-14,'Optical field width');
  for(const share of [-.25,0,.25,.5,.75,1,1.25]){
    const center=left+(right-left)*share,x0=Math.max(left,center-.125),x1=Math.min(right,center+.125),y=Math.min(.35,range*.001/.0125);
    const direct=x1>x0?simpson(x=>simpson(z=>range**2/(range**2+(x-lenslet)**2+z*z)**2,-y,y,32),x0,x1,32):0;
    near(burglarProjectedAngle(x0-lenslet,x1-lenslet,-y,y,range),direct,Math.abs(direct)*2e-7+1e-14,'Independent projected source integral');
  }
  fields++;
}

const convergence=[];
for(const trial of lesson.tryIt){
  const plan=pirPlan(trial.values),half=pirPlan(trial.values,{step:.0005});let maxError=0,peak=0;
  for(let k=0;k<=480;k++){const a=pirAt(plan,k/40),b=pirAt(half,k/40);maxError=Math.max(maxError,Math.abs(a.output-b.output));peak=Math.max(peak,Math.abs(b.output));near(a.output,a.outputA-a.outputB,1e-18,'Opposed response is subtraction');}
  near(maxError,0,Math.max(2e-10,peak*.003),'Half-step convergence');
  assert.equal(plan.alarmAt===null,half.alarmAt===null);checks++;
  if(plan.alarmAt!==null)near(plan.alarmAt,half.alarmAt,.002,'Confirmation timing convergence');
  convergence.push({title:trial.title,maxError,peak,alarmAt:plan.alarmAt,halfStepAlarmAt:half.alarmAt});
}

// Separate cascade equations, integrated by RK4 rather than the production lag solver.
const rk4=(fn,s,t,dt)=>{const a=fn(t,s),b=fn(t+dt/2,s.map((x,i)=>x+a[i]*dt/2)),c=fn(t+dt/2,s.map((x,i)=>x+b[i]*dt/2)),d=fn(t+dt,s.map((x,i)=>x+c[i]*dt));return s.map((x,i)=>x+dt*(a[i]+2*b[i]+2*c[i]+d[i])/6);};
const independent=[];
for(const index of [0,2,3,4,5,6,7,9,10,11]){
  const trial=lesson.tryIt[index],v=pirSharedSettings(trial.values),plan=pirPlan(trial.values);
  const input=time=>{const p=burglarPIR(v,time);return p.plus*(1+v.balance/200)-p.minus*(1-v.balance/200);};
  const first=input(0),gain=4200/(2*Math.PI/Math.hypot(1,2*Math.PI)/Math.hypot(1,.2*Math.PI));
  let state=[first,first],maxError=0,peak=0,firstAbove=null,alarm=null;
  const dt=.00025,fn=(time,s)=>[(input(time)-s[0])/.1,(s[0]-s[1])];
  for(let k=1;k<=48000;k++){
    const time=k*dt;state=rk4(fn,state,time-dt,dt);const output=v.power?gain*(state[0]-state[1]):0;
    if(Math.abs(output)>=.0001){firstAbove??=time;if(alarm===null&&time-firstAbove>=.05)alarm=time;}else firstAbove=null;
    if(k%100===0){peak=Math.max(peak,Math.abs(output));maxError=Math.max(maxError,Math.abs(output-pirAt(plan,time).output));}
  }
  near(maxError,0,Math.max(2e-10,peak*.003),'Independent thermal and leakage cascade');assert.equal(alarm===null,plan.alarmAt===null);checks++;
  if(alarm!==null)near(alarm,plan.alarmAt,.002,'Independent confirmation time');
  independent.push({title:trial.title,maxError,peak,alarm,productionAlarm:plan.alarmAt});
}

for(const key of Object.keys(D)){
  const [lo,hi,step]=PIR_DOMAINS[key];
  for(const value of [NaN,Infinity,lo-step,hi+step]){assert.throws(()=>pirPlan({[key]:value}));checks++;}
}
for(const bad of [{mode:0},{span:5},{path:1},{hold:50},{balance:2},{pace:.75},null,[]]){assert.throws(()=>pirSettings(bad));checks++;}
const report={passed:true,checks,temperatures:temperatures.size,fields,convergence,independent};
if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/physics.json',JSON.stringify(report,null,2));}
console.log(`PASS passive infrared physics: ${checks} checks; ${fields} fields; ${convergence.length} convergence cases; ${independent.length} independent response cases`);

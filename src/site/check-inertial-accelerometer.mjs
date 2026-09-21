import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {inertialAccelerometerLesson as lesson} from './inertial-accelerometer-lesson.js';

const evidence=new URL(process.env.INERTIAL_ACCELEROMETER_EVIDENCE||'../../documentation/audit/evidence/inertial-accelerometer/',import.meta.url);
await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
const control=key=>page.locator(`[data-control="${key}"]`),number=key=>page.locator(`[data-number="${key}"]`);
const read=()=>page.locator('.daily-readings > div:not(.daily-reading-group)').evaluateAll(nodes=>{
 const rows=Object.fromEntries(nodes.map(node=>[node.querySelector('dt')?.textContent,node.querySelector('dd')?.textContent]));
 const hints=Object.fromEntries(nodes.map(node=>[node.querySelector('dt')?.textContent,node.querySelector('p')?.textContent]));
 for(const [card,labels]of [['Primary current',['Excitation frequency','Carrier phase']],['Primary terminal voltage',['Primary inductance']],['Left pickup voltage',['Left gap','Left mutual inductance']],['Right pickup voltage',['Right gap','Right mutual inductance']]])for(const label of labels){const match=hints[card]?.match(new RegExp(label+': ([^ ]+)'));if(!match)throw new Error('Missing explained parameter '+label);rows[label]=match[1];}
 return rows;
});
const near=(actual,expected,tolerance=.000006)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected} (tolerance ${tolerance})`);
// Display rounding is separate from the independent high-order physical checks.
const displayNear=(actual,expected)=>near(actual,expected,Math.max(1e-6,expected?0.50001*10**(Math.floor(Math.log10(Math.abs(expected)))-2):0)+3e-8);
const frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true});
const stageLabels=['Inspect the start (0 s)','Inspect the early first pulse (0.1 × pulse duration)','Inspect the first-pulse response (0.75 × pulse duration)','Inspect coasting (1.5 × pulse duration)','Inspect the reversed pulse (2.75 × pulse duration)','Inspect after the drive (3 × pulse duration)','Inspect the final response (6 s)'];
const stageTimes=T=>[0,.1*T,.75*T,1.5*T,2.75*T,3*T,6];
const inspect=index=>page.getByRole('button',{name:stageLabels[index],exact:true}).click();

// Independent event-split integration of the declared circuit, with no production sampler import.
const w=2*Math.PI*50,m=.01,k=10;
function electrical(t,q,v,e){
 const current=.01*e*Math.sin(w*t),rate=.01*e*w*Math.cos(w*t),lp=.02+100*q*q;
 return {current,rate,lp,left:(.002+.1*q)*rate+.1*v*current,right:(.002-.1*q)*rate-.1*v*current,difference:.2*(q*rate+v*current),motion:.2*v*current,force:100*q*current*current,primary:lp*rate+200*q*v*current};
}
function reference(values,t){
 const {acceleration:A,pulseDuration:T,damping:zeta,excitation:e}=values,c=2*zeta*Math.sqrt(m*k);let state=[0,0,0,0,0,0];
 const rhs=(time,y,a)=>{const [q,v,z]=y,p=electrical(time,q,v,e);return [v,(-c*v-k*q-m*a+p.force)/m,(2*p.difference*Math.cos(w*time)-z)/.05,p.current*p.primary,c*v*v,-m*a*v];};
 for(const [start,end,a] of [[0,T,A],[T,2*T,0],[2*T,3*T,-A],[3*T,6,0]]){
  if(t<=start)break;const stop=Math.min(t,end),n=Math.ceil((stop-start)*8000),h=(stop-start)/n;
  for(let j=0;j<n;j++){
   const time=start+j*h,a1=rhs(time,state,a),a2=rhs(time+h/2,state.map((v,i)=>v+h*a1[i]/2),a),a3=rhs(time+h/2,state.map((v,i)=>v+h*a2[i]/2),a),a4=rhs(time+h,state.map((v,i)=>v+h*a3[i]),a);
   state=state.map((v,i)=>v+h*(a1[i]+2*a2[i]+2*a3[i]+a4[i])/6);
  }
 }
 const [q,v,z,sourceWork,dampingLoss,baseWork]=state,p=electrical(t,q,v,e),r=s=>Math.max(s,0);
 const acceleration=t<T?A:t<2*T?0:t<3*T?-A:0;
 const velocity=A*(t-r(t-T)-r(t-2*T)+r(t-3*T));
 const position=A/2*(t*t-r(t-T)**2-r(t-2*T)**2+r(t-3*T)**2);
 const indicatedDisplacement=e?z/(.2*.01*e*w):null,indicatedAcceleration=e?-1000*indicatedDisplacement:null;
 return {q,v,z,p,acceleration,velocity,position,indicatedDisplacement,indicatedAcceleration,sourceWork,baseWork,dampingLoss,mechanicalEnergy:.5*m*v*v+.5*k*q*q,magneticEnergy:.5*p.lp*p.current*p.current,c};
}
async function compare(values,t){
 const row=await read(),s=reference(values,t),r=s.p;
 const expected={'Observation time':t,'Observation progress':100*t/6,'Housing acceleration':s.acceleration,'Housing velocity':s.velocity,'Housing displacement':s.position,'Armature relative displacement':s.q*1000,'Armature relative velocity':s.v*1000,'Absolute armature displacement':s.position+s.q,'Absolute armature velocity':s.velocity+s.v,'Primary current':r.current*1000,'Primary terminal voltage':r.primary*1000,'Left pickup voltage':r.left*1000,'Right pickup voltage':r.right*1000,'Differential voltage':r.difference*1000,'Motion contribution':r.motion*1000,'Filtered differential output':s.z*1000,'Left gap':7-s.q*1000,'Right gap':7+s.q*1000,'Spring force':-k*s.q*1000,'Damping force':-s.c*s.v*1000,'Magnetic force':r.force*1000,'Inertial forcing':-m*s.acceleration*1000,'Mechanical energy':s.mechanicalEnergy*1000,'Magnetic energy':s.magneticEnergy*1000,'Electrical source work':s.sourceWork*1000,'Base forcing work':s.baseWork*1000,'Damping loss':s.dampingLoss*1000};
 Object.assign(expected,{'Primary inductance':r.lp*1000,'Left mutual inductance':(.002+.1*s.q)*1000,'Right mutual inductance':(.002-.1*s.q)*1000,'Excitation frequency':50});
 for(const [label,value] of Object.entries(expected)){assert.ok(label in row,`Missing reading ${label}`);if(label==='Observation progress')near(parseFloat(row[label]),value,.051);else if(label==='Observation time')near(parseFloat(row[label]),value,.0005001);else displayNear(parseFloat(row[label]),value);}
 const expectedPhase=(t*50%1)*360,actualPhase=parseFloat(row['Carrier phase']);near(((actualPhase-expectedPhase+540)%360)-180,0,.500001);
 for(const [label,value] of [['Indicated displacement',s.indicatedDisplacement===null?null:s.indicatedDisplacement*1000],['Indicated acceleration',s.indicatedAcceleration],['Indication error',s.indicatedAcceleration===null?null:s.indicatedAcceleration-s.acceleration]]){
  if(value===null)assert.match(row[label],/unavailable/i);else displayNear(parseFloat(row[label]),value);
 }
 const balance=row['Energy balance error'];
 assert(balance==='Magnitude below 1 pJ'||/^-?[\d.e+-]+ pJ$/.test(balance));
 near(balance==='Magnitude below 1 pJ'?0:parseFloat(balance)*1e-12,0,2e-9);
 near(s.sourceWork+s.baseWork-s.mechanicalEnergy-s.magneticEnergy-s.dampingLoss,0,2e-9);
 return {time:t,values:{...values},readings:row};
}
async function setValue(key,value){if(['pulseDuration','excitation'].includes(key))await control(key).selectOption(String(value));else await number(key).fill(String(value));}
async function preset(index){
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(index).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
 for(const [key,value] of Object.entries(lesson.tryIt[index].values))assert.equal(Number(await control(key).inputValue()),value);
 await compare(lesson.tryIt[index].values,0);
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/inertial-accelerometer-armature-spring-and-coils`);
 await page.getByRole('heading',{name:'Inertial accelerometer armature, spring, and coils',exact:true}).waitFor();
 assert.equal(await page.locator('.daily-readings > div:not(.daily-reading-group)').count(),33);assert.equal(await page.locator('.daily-readings > div:not(.daily-reading-group)>p').count(),33);
 assert.deepEqual(await page.locator('.daily-reading-group dt').allTextContents(),['Mechanics','AC circuit','Detector','Energy','Read the records']);
 assert.deepEqual(await page.locator('.daily-action-group legend').allTextContents(),['Observation stages','Inspect the instrument']);
 assert.equal(await page.locator('.daily-action-group').nth(0).locator('[data-action]').count(),7);assert.equal(await page.locator('.daily-action-group').nth(1).locator('[data-action]').count(),6);
 assert.equal(await page.locator('[data-control]').count(),4);assert.equal(lesson.tryIt.length,10);await shot('initial');
 const trials=[];
 for(let i=0;i<lesson.tryIt.length;i++){
  await preset(i);const rows=[],times=stageTimes(lesson.tryIt[i].values.pulseDuration);
  for(let j=0;j<times.length;j++){await inspect(j);rows.push(await compare(lesson.tryIt[i].values,times[j]));if([0,2,4,5,8,9].includes(i)&&[1,2,3,4].includes(j))await shot(`stage-${i}-${j}`);}
  trials.push(rows);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 assert.equal(trials[4][3].readings['Indicated acceleration'],'0.681 m/s²');
 assert.equal(trials[5][1].readings['Armature relative displacement'],'-1.44 mm');
 assert.equal(trials[0][2].readings['Indicated acceleration'],'1 m/s²');
 const allControls=[];
 for(const acceleration of [-2,-1,0,1,2])for(const pulseDuration of [.1,.25,.5,1])for(const damping of [.25,.5,.75,1,1.25])for(const excitation of [0,.5,1]){
  const values={acceleration,pulseDuration,damping,excitation};for(const [key,value] of Object.entries(values))await setValue(key,value);
  await compare(values,0);await inspect(2);allControls.push(await compare(values,.75*pulseDuration));
  if(allControls.length%60===0)console.log(`PASS control settings ${allControls.length}/300`);
 }
 await preset(4);await page.locator('[data-step]').click();await compare(lesson.tryIt[4].values,.06);
 await page.locator('[data-play]').click();await frames();await page.locator('[data-play]').click();const paused=await read();await frames();assert.deepEqual(await read(),paused);
 await preset(4);await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:50000});await compare(lesson.tryIt[4].values,6);
 await page.locator('[data-result]').click();await compare(lesson.tryIt[4].values,6);await shot('result');
 await page.locator('[data-play]').click();await frames();await page.locator('[data-play]').click();const replay=await read(),replayTime=parseFloat(replay['Observation time']);assert.ok(replayTime>0&&replayTime<1);
 for(const [key,value] of Object.entries({acceleration:-1,pulseDuration:.25,damping:1,excitation:.5})){await inspect(6);await setValue(key,value);near(parseFloat((await read())['Observation time']),0);}
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,value] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),value);await compare(lesson.tryIt[0].values,0);
 await number('acceleration').focus();await page.keyboard.press('ArrowDown');assert.equal(Number(await number('acceleration').inputValue()),0);near(parseFloat((await read())['Observation time']),0);
 await preset(4);await inspect(3);const held=await read();
 for(const name of ['Inspect the armature and spring','Inspect the three coils','Inspect the signal processor','Inspect the response record','Inspect the AC signal window','Inspect housing travel']){await page.getByRole('button',{name,exact:true}).click();assert.deepEqual(await read(),held);await shot(name.toLowerCase().replaceAll(' ','-'));}
 await page.getByRole('checkbox',{name:'Look inside',exact:true}).uncheck();assert.deepEqual(await read(),held);await shot('exterior');await page.getByRole('checkbox',{name:'Look inside',exact:true}).check();
 await page.locator('[data-labels]').check();assert.ok(await page.locator('[data-label-part]').count()>5);await shot('labels');await page.locator('[data-labels]').uncheck();
 await page.getByRole('button',{name:lesson.quiz.options[lesson.quiz.answer],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});
 for(const i of [0,1,2,4,5,8,9]){
  await preset(i);await inspect(3);await compare(lesson.tryIt[i].values,1.5*lesson.tryIt[i].values.pulseDuration);await shot('mobile-coast-'+i);
  for(const name of ['Inspect the armature and spring','Inspect the response record','Inspect the AC signal window']){await page.getByRole('button',{name,exact:true}).click();await shot('mobile-'+i+'-'+name.toLowerCase().replaceAll(' ','-'));}
  await inspect(6);await compare(lesson.tryIt[i].values,6);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile-result-'+i);
 }
 assert.deepEqual(errors,[]);
 const report={passed:true,trials,allControls,replayTime,checks:'ten complete presets at seven pulse-relative stages; all300 tuples fresh/interior; independent event-split circuit and selected DOP853 values; motion, voltages, lag, unavailable indication and energy; actual12s play, pause, step, reset, replay, result, edits and keyboard; inspection, cover and labels; quiz and390px phone'};
 await writeFile(new URL('browser-results.json',evidence),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,experiments:10,controls:300,checks:report.checks},null,2));
}finally{await browser.close();}

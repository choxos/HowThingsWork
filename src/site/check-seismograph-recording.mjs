import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {seismographRecordingLesson as lesson} from './seismograph-recording-lesson.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL(process.env.SEISMOGRAPH_RECORDING_EVIDENCE||'../../documentation/audit/evidence/seismograph-recording/',import.meta.url);await mkdir(evidence,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const value=async label=>parseFloat(await reading(label)),control=key=>page.locator(`[data-control="${key}"]`),number=key=>page.locator(`[data-number="${key}"]`);
// Display rounding only; independent physical tolerances remain in the model check.
const rounding=n=>n===0?0:.5*10**(Math.floor(Math.log10(Math.abs(n)))-2);
const near=(actual,expected,tolerance=.000003)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);
const frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true});
const times=[0,3.125,5,6.5,16],stages=['Inspect the start (0 s)','Inspect before the lift (3.125 s)','Inspect the pen (5 s)','Inspect resumed recording (6.5 s)','Inspect the final paper (16 s)'];
const inspect=i=>page.getByRole('button',{name:stages[i],exact:true}).click();

// Independent direct envelope derivatives and refined force integration.
function reference(v){
 const w=2*Math.PI*v.frequency,b=Math.PI/8,A=v.amplitude/1000,wn=2*Math.PI;
 const ground=t=>{if(t<=0||t>=8)return [0,0];const e=Math.sin(b*t)**2,de=b*Math.sin(2*b*t),dde=2*b*b*Math.cos(2*b*t);return [A*e*Math.sin(w*t),A*((dde-w*w*e)*Math.sin(w*t)+2*w*de*Math.cos(w*t))];};
 const derivative=(t,q)=>[q[1],-wn*q[1]-wn*wn*q[0]-ground(t)[1]],add=(q,k,h)=>q.map((x,i)=>x+h*k[i]);
 function step(t,q,h){const a=derivative(t,q),b=derivative(t+h/2,add(q,a,h/2)),c=derivative(t+h/2,add(q,b,h/2)),d=derivative(t+h,add(q,c,h));return q.map((x,i)=>x+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);}
 let q=[0,0],t=0;const rows=[];for(const time of times){while(t<time){const h=Math.min(1/4096,time-t);q=step(t,q,h);t+=h;}rows.push({time,ground:ground(time)[0],relative:q[0],velocity:q[1]});}return rows;
}
async function preset(i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);near(await value('Observation time'),0);near(await value('Paper travel'),0);near(await value('Recorded time'),0);}
async function response(v,s){
 const up=v.penMode===1||(v.penMode===2&&s.time>=4&&s.time<6),unrecorded=v.penMode===1?s.time:v.penMode===2?Math.max(0,Math.min(2,s.time-4)):0;
 const expected={'Ground displacement':s.ground*1000,'Absolute mass displacement':(s.ground+s.relative)*1000,'Mass relative to frame':s.relative*1000,'Relative velocity':s.velocity*1000,'Paper speed':v.paperSpeed,'Paper travel':s.time*v.paperSpeed,'Pen clearance':up?.51:0,'Recorded time':s.time-unrecorded,'Unrecorded time':unrecorded,'Observation time':s.time,'Observation progress':s.time/16*100};
 const actual={};for(const [label,n] of Object.entries(expected)){actual[label]=await value(label);near(actual[label],n,label==='Observation progress'?.051:['Observation time','Recorded time','Unrecorded time'].includes(label)?.00051:rounding(actual[label])+.000003);}
 actual.contact=await reading('Pen contact');assert.match(actual.contact,up?/lift|clear|up/i:/down|touch|contact/i);
 actual.axes=await reading('Recording axes');if(v.paperSpeed===0)assert.match(actual.axes,/no .*time|not .*time|undefined|overprint/i);
 return actual;
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/seismograph-recording-pen-and-moving-paper`);await page.getByRole('heading',{name:'Seismograph recording pen and moving paper',exact:true}).waitFor();assert.equal(await page.locator('[data-control]').count(),4);await shot('initial');
 const trials=[],references=lesson.tryIt.map(x=>reference(x.values));assert.equal(lesson.tryIt.length,10);
 for(let i=0;i<10;i++){await preset(i);const rows=[];for(let j=0;j<times.length;j++){await inspect(j);rows.push(await response(lesson.tryIt[i].values,references[i][j]));if(i===5)await shot('gap-stage-'+j);}trials.push(rows);await page.getByRole('button',{name:'Inspect the paper',exact:true}).click();await page.getByRole('button',{name:'Front',exact:true}).click();await shot('experiment-'+i);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);}
 const end=i=>trials[i].at(-1);near(end(0)['Paper travel'],32);near(end(1)['Paper travel'],16);near(end(2)['Paper travel'],8);near(end(3)['Paper travel'],0);near(end(4)['Recorded time'],0);near(end(5)['Unrecorded time'],2);near(end(6)['Unrecorded time'],2);
 for(let i=1;i<=6;i++)for(let j=0;j<5;j++)near(trials[i][j]['Mass relative to frame'],trials[0][j]['Mass relative to frame']);
 for(let j=0;j<5;j++){near(trials[7][j]['Mass relative to frame'],0);near(trials[8][j]['Mass relative to frame'],2*trials[0][j]['Mass relative to frame'],rounding(trials[8][j]['Mass relative to frame'])+2*rounding(trials[0][j]['Mass relative to frame'])+.000003);}
 await preset(0);await page.locator('[data-step]').click();near(await value('Observation time'),.16);await page.locator('[data-play]').click();await frames();await page.locator('[data-play]').click();const paused=await page.locator('.daily-readings').textContent();await frames();assert.equal(await page.locator('.daily-readings').textContent(),paused);
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:60000});await response(lesson.tryIt[0].values,references[0][4]);await page.locator('[data-result]').click();await shot('result');await page.locator('[data-play]').click();await frames();await page.locator('[data-play]').click();assert.ok(await value('Observation time')<16);assert.ok(await value('Paper travel')<32);
 for(const [key,n] of [['amplitude','4'],['frequency','1'],['paperSpeed','1.5'],['penMode','2']]){await inspect(4);if(key==='penMode')await control(key).selectOption(n);else await number(key).fill(n);near(await value('Observation time'),0);near(await value('Paper travel'),0);near(await value('Recorded time'),0);}
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),n);await number('paperSpeed').focus();await page.keyboard.press('ArrowDown');assert.equal(Number(await number('paperSpeed').inputValue()),1.5);await inspect(4);near(await value('Paper travel'),24);
 await preset(5);await inspect(2);const retained=await page.locator('.daily-readings').textContent();await page.getByRole('button',{name:'Inspect the pen tip',exact:true}).click();assert.equal(await page.locator('.daily-readings').textContent(),retained);await shot('lifted-pen-detail');await page.getByRole('button',{name:'Inspect the paper',exact:true}).click();assert.equal(await page.locator('.daily-readings').textContent(),retained);
 await page.locator('[data-labels]').check();assert.ok(await page.locator('[data-label-part]').count()>3);await shot('labels');await page.locator('[data-labels]').uncheck();await page.getByRole('button',{name:lesson.quiz.options[lesson.quiz.answer],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});for(const i of [0,3,4,5,7]){await preset(i);await inspect(4);await response(lesson.tryIt[i].values,references[i][4]);await page.getByRole('button',{name:'Inspect the paper',exact:true}).click();await page.getByRole('button',{name:'Front',exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile-'+i);}
 await preset(7);await number('paperSpeed').fill('0');await control('penMode').selectOption('2');await inspect(2);await response({...lesson.tryIt[7].values,paperSpeed:0,penMode:2},references[7][2]);await page.getByRole('button',{name:'Inspect the paper',exact:true}).click();await page.getByRole('button',{name:'Front',exact:true}).click();await page.getByRole('checkbox',{name:'Isolate selected part',exact:true}).check();await shot('mobile-stationary-ink-dot');
 assert.deepEqual(errors,[]);const report={passed:true,trials,checks:'10 presets at5 stages; independent envelope-force integration; feed/contact input invariance; physical contact clearance; retained time and gaps; all controls and1.5 speed; playback/pause/step/reset/replay/result; keyboard; labels; quiz; detail and phone'};await writeFile(new URL('browser-results.json',evidence),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,experiments:10,checks:report.checks},null,2));
}finally{await browser.close();}

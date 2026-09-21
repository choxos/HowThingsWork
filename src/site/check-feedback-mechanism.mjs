import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {feedbackMechanismLesson as lesson} from './feedback-mechanism-lesson.js';
import {sampleFeedback} from './feedback-mechanism-model.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL(process.env.FEEDBACK_EVIDENCE||'../../documentation/audit/evidence/feedback-mechanism/',import.meta.url);await mkdir(evidence,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const value=async label=>parseFloat(await reading(label)),control=key=>page.locator(`[data-control="${key}"]`),number=key=>page.locator(`[data-number="${key}"]`);
const near=(a,b,tolerance=.0001)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`),play=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:60000});
const nextFrames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))));
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true});
const stages=['Inspect initial state (0 s)','Inspect before withdrawal (119 s)','Inspect after withdrawal (121 s)','Inspect responding (160 s)','Inspect final state (240 s)'],times=[0,119,121,160,240];
const inspect=i=>page.getByRole('button',{name:stages[i],exact:true}).click();
async function preset(i){
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
 for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);
 near(await value('Observation progress'),0);near(await value('Water level'),lesson.tryIt[i].values.level-60);
}
async function response(v){
 const s={};for(const key of ['Water level','Valve opening','Inlet flow','Requested withdrawal','Delivered withdrawal','Overflow now','Unmet withdrawal','Initial water','Stored water','Admitted water','Delivered water','Overflowed water','Unmet demand','Water balance','Observation progress','Observation time'])s[key]=await value(key);
 const openingText=await reading('Valve opening');if(openingText.startsWith('<'))s['Valve opening']=openingText;
 const exact=sampleFeedback({...v,level:v.level/1000},s['Observation time']),display=(n,d)=>d!==undefined?Number(n.toFixed(d)):Math.abs(n)<1e-6?0:Number(n.toPrecision(3));
 const fields={'Water level':['level',1000,1],'Valve opening':['opening',100,1],'Inlet flow':['inletFlow',1000],'Requested withdrawal':['requestedFlow',1000],'Delivered withdrawal':['withdrawalFlow',1000],'Overflow now':['overflowFlow',1000],'Unmet withdrawal':['unmetFlow',1000],'Initial water':['initialVolume',1000],'Stored water':['storedVolume',1000],'Admitted water':['inletVolume',1000],'Delivered water':['withdrawnVolume',1000],'Overflowed water':['overflowVolume',1000],'Unmet demand':['unmetVolume',1000],'Water balance':['balanceError',1000,3]};
 // Compare each rounded card with its finite-time reference. Conservation uses
 // unrounded volumes, as explained beside the balance reading.
 for(const [label,[key,scale,precision]] of Object.entries(fields)){if(label==='Valve opening'&&exact.opening>0&&exact.opening*100<.05)assert.equal(s[label],'< 0.1%');else near(s[label],display(exact[key]*scale,precision),.000000001);}
 near(exact.initialVolume+exact.inletVolume,exact.storedVolume+exact.withdrawnVolume+exact.overflowVolume,1e-16);near(exact.withdrawnVolume+exact.unmetVolume,Math.max(0,exact.elapsed-120)*v.demand/1000,1e-16);near(exact.withdrawalFlow+exact.unmetFlow,exact.requestedFlow,1e-16);
 assert.ok(s['Stored water']>=0&&s['Stored water']<=16.5);for(const key of ['Admitted water','Delivered water','Overflowed water','Unmet demand'])assert.ok(s[key]>=0);
 return s;
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/feedback-mechanism`);await page.getByRole('heading',{name:'Feedback mechanism',exact:true}).waitFor();await page.locator('.daily-readings').waitFor();
 assert.equal(await page.locator('[data-control]').count(),4);assert.equal(await page.locator('.daily-readings>div p').count(),21);assert.equal(await number('level').inputValue(),'180');assert.equal(await control('level').getAttribute('min'),'120');assert.equal(await control('level').getAttribute('max'),'240');await shot('initial');await page.getByRole('checkbox',{name:'Look inside',exact:true}).uncheck();await shot('exterior');await page.getByRole('checkbox',{name:'Look inside',exact:true}).check();
 const outcomes=[],transients=[];
 for(let i=0;i<lesson.tryIt.length;i++){
  const v=lesson.tryIt[i].values;await preset(i);
  if(i===0){await page.locator('[data-step]').click();near(await value('Observation progress'),1,.051);await play();await nextFrames();await play();const paused=await page.locator('.daily-readings').textContent();await nextFrames();assert.equal(await page.locator('.daily-readings').textContent(),paused);}
  for(let j=0;j<stages.length;j++){
   await inspect(j);near(await value('Observation time'),times[j],.00001);
   for(const [key,n] of Object.entries(v))assert.equal(Number(await control(key).inputValue()),n);
   const s=await response(v);if(i===0){transients.push(s);await shot('stage-'+j);}
  }
  outcomes.push(await response(v));if(i===0)assert.equal(await reading('Your result'),'165 mm · flows nearly balanced');await shot('experiment-'+i);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 assert.ok(transients[1]['Water level']>transients[0]['Water level']&&transients[1]['Valve opening']<transients[0]['Valve opening']);
 assert.ok(transients[2]['Water level']<transients[1]['Water level']&&transients[2]['Valve opening']>transients[1]['Valve opening']);
 near(outcomes[0]['Water level'],165,.2);near(outcomes[0]['Inlet flow'],.04,.0002);near(outcomes[1]['Water level'],180,.002);near(outcomes[1]['Delivered water'],0);
 near(outcomes[2]['Water level'],300);near(outcomes[2]['Overflowed water'],4.5);assert.ok(outcomes[2]['Overflow now']>0);
 for(const i of [3,7]){near(outcomes[i]['Stored water'],1.8);near(outcomes[i]['Delivered water'],4.8);near(outcomes[i]['Inlet flow'],0);}
 near(outcomes[3]['Valve opening'],0);near(outcomes[7]['Valve opening'],100);
 near(outcomes[4]['Stored water'],0);near(outcomes[4]['Valve opening'],100);near(outcomes[4]['Delivered withdrawal'],.08);near(outcomes[4]['Unmet withdrawal'],.12);assert.ok(outcomes[4]['Unmet demand']>0);
 near(outcomes[5]['Water level'],172.5,.002);near(outcomes[6]['Water level'],225,.2);assert.ok(outcomes[5]['Valve opening']<outcomes[0]['Valve opening']);
 await preset(0);await play();await finished();near(await value('Observation progress'),100);await page.locator('[data-result]').click();await shot('result');await play();await nextFrames();await play();assert.ok(await value('Observation progress')<100);near(await value('Delivered water'),0);const paused=await page.locator('.daily-readings').textContent();await nextFrames();assert.equal(await page.locator('.daily-readings').textContent(),paused);
 for(const [key,next] of [['level','240'],['pressure','4'],['demand','.2'],['mode','1']]){await inspect(3);if(key==='mode')await control(key).selectOption(next);else await number(key).fill(next);near(await value('Observation progress'),0);near(await value('Admitted water'),0);near(await value('Delivered water'),0);}
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),n);
 await number('pressure').focus();await page.keyboard.press('ArrowUp');assert.equal(Number(await number('pressure').inputValue()),2);await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});await preset(4);await inspect(4);await page.evaluate(()=>window.scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile-capacity');near(await value('Stored water'),0);await preset(2);await inspect(4);await shot('mobile-overflow');near(await value('Overflowed water'),4.5);assert.deepEqual(errors,[]);
 await page.goto('about:blank');await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/feedback-mechanism?part=float`);await page.locator('.daily-readings').waitFor();assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Buoyant level-sensing float');await shot('float-bookmark');
 const report={passed:true,outcomes,transients,checks:'eight presets;five stages;all controls;negative feedback and disturbance;water balance;held valves;empty and overflow boundaries;pause/step/reset/edit/replay/result/keyboard/quiz/mobile'};
 await writeFile(new URL('browser-results.json',evidence),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}

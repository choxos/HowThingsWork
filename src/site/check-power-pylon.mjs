import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {powerPylonLesson as lesson} from './power-pylon-lesson.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL('../../documentation/audit/evidence/power-pylon/',import.meta.url);await mkdir(evidence,{recursive:true});
page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const value=async label=>parseFloat(await reading(label));
const control=key=>page.locator(`[data-number="${key}"]`);
const near=(actual,expected,tol=.002)=>assert.ok(Math.abs(actual-expected)<=tol,`${actual} differs from ${expected}`);
const run=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:90000});
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true});
function expected(v){const q=v.span/(2*v.tension),sag=v.tension*(Math.cosh(q)-1),length=2*v.tension*Math.sinh(q);return {sag,minimum:v.height-sag,length,vertical:length/2,endpoint:Math.hypot(v.tension,length/2)};}
async function preset(i){
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
 for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);
 assert.equal(await value('Inspection time'),0);assert.equal(await reading('Measured minimum height'),'Not inspected');
}
async function checkResult(v){
 const e=expected(v);
 for(const [label,n] of Object.entries({'Attachment height':v.height,'Support spacing':v.span,'Horizontal tension':v.tension,'Calculated sag':e.sag,'Configured minimum height':e.minimum,'Measured minimum height':e.minimum,'Cable length':e.length,'Cable weight':e.length,'Vertical load per support':e.vertical,'Endpoint tension':e.endpoint,'Inspection progress':100,'Inspection time':6}))near(await value(label),n);
 return e;
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/power-pylon`);await page.getByRole('heading',{name:'Power pylon',exact:true}).waitFor();await page.locator('.daily-readings').waitFor();
 assert.equal(await page.locator('[data-control]').count(),3);assert.equal(await page.locator('[data-number]').count(),3);await shot('initial');
 const outcomes=[];
 for(let i=0;i<lesson.tryIt.length;i++){
  await preset(i);
  if(i===0){
   await page.locator('[data-step]').click();near(await value('Inspection progress'),1);near(await value('Inspection time'),.06);
   const v=lesson.tryIt[0].values,x=-.49*v.span;near(await value('Measured minimum height'),v.height-v.tension*(Math.cosh(v.span/(2*v.tension))-Math.cosh(x/v.tension)));
   await run();await page.waitForTimeout(300);await run();const held=await page.locator('.daily-readings').textContent();await page.waitForTimeout(250);assert.equal(await page.locator('.daily-readings').textContent(),held);assert.ok(await value('Measured minimum height')>await value('Configured minimum height'));await shot('paused');
  }
  await run();await finished();outcomes.push(await checkResult(lesson.tryIt[i].values));await shot('experiment-'+i);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 near(outcomes[1].minimum-outcomes[0].minimum,2);near(outcomes[1].sag,outcomes[0].sag);near(outcomes[1].endpoint,outcomes[0].endpoint);
 assert.ok(outcomes[2].minimum<outcomes[0].minimum&&outcomes[2].length>outcomes[0].length);assert.ok(outcomes[3].sag<outcomes[0].sag&&outcomes[3].endpoint>outcomes[0].endpoint);assert.ok(outcomes[4].minimum>.23&&outcomes[4].minimum<.24);
 await page.locator('[data-result]').click();await shot('result');await run();await page.waitForTimeout(150);await run();assert.ok(await value('Inspection progress')<100);
 for(const [key,next] of [['height','6'],['span','8'],['tension','36']]){await page.locator('[data-step]').click();assert.ok(await value('Inspection time')>0);await control(key).fill(next);assert.equal(await value('Inspection time'),0);assert.equal(await reading('Measured minimum height'),'Not inspected');}
 near(await value('Configured minimum height'),expected({height:6,span:8,tension:36}).minimum);await run();await finished();await checkResult({height:6,span:8,tension:36});await shot('highest-configuration');
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),n);assert.equal(await reading('Measured minimum height'),'Not inspected');
 await control('height').focus();await page.keyboard.press('ArrowUp');assert.equal(Number(await control('height').inputValue()),4);
 await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));await page.waitForFunction(()=>window.scrollY===0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,outcomes,checks:'five complete presets; three controls; stationary span inspection; measured/configured minimum; sag/length/support forces; height/span/tension comparisons; lowest/highest envelopes; pause/1percentstep/reset/edit/replay/result/keyboard/quiz/mobile'},null,2));
}finally{await browser.close();}

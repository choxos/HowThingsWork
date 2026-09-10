import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {electricityTransmissionLesson as lesson} from './electricity-transmission-lesson.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL('../../documentation/audit/evidence/electricity-transmission/',import.meta.url);
await mkdir(evidence,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const value=async label=>parseFloat(await reading(label));
const run=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:90000});
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true});
const near=(actual,expected,tol=.025)=>assert.ok(Math.abs(actual-expected)<=tol,`${actual} differs from ${expected}`);
const control=key=>page.locator(`[data-${['ratio','connected'].includes(key)?'control':'number'}="${key}"]`);
async function preset(i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
const outcomes=[];
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/electricity-transmission`);
 await page.getByRole('heading',{name:'Electricity transmission',exact:true}).waitFor();await page.locator('.daily-readings').waitFor();await shot('initial');
 for(let i=0;i<lesson.tryIt.length;i++){
  await preset(i);const v=lesson.tryIt[i].values;
  for(const [key,expected] of Object.entries(v))assert.equal(Number(await control(key).inputValue()),expected);
  assert.equal(await value('Simulated time'),0);assert.equal(await value('Delivered load energy'),0);
  if(i===0){
   await page.locator('[data-step]').click();near(await value('Electrical phase'),1,.01);
   await run();await page.waitForTimeout(350);await run();const held=await page.locator('.daily-readings').textContent();await page.waitForTimeout(250);assert.equal(await page.locator('.daily-readings').textContent(),held);
   const t=await value('Simulated time')/1000,mean=await value('Mean load power');
   near(await value('Delivered load energy'),mean*(t+Math.sin(4*Math.PI*50*t)/(4*Math.PI*50))*1000,.15);await shot('paused');
  }
  await run();await finished();near(await value('Simulated time'),40,.001);near(await value('Electrical phase'),0,.01);
  const a=v.ratio,r=v.lineResistance,load=v.loadResistance;
  const current=v.connected?12*a/(r+a*a*load):0,sourceCurrent=a*current;
  const sending=12*a,receiving=sending-current*r,service=receiving/a,voltage=v.connected?service:0;
  const heat=current*current*r,power=sourceCurrent*sourceCurrent*load,source=12*sourceCurrent;
  for(const [label,expected] of Object.entries({'Sending RMS voltage':sending,'Receiving RMS voltage':receiving,'Available consumer RMS voltage':service,'Load RMS voltage':voltage,'Line RMS current':current,'Source RMS current':sourceCurrent,'Load RMS current':sourceCurrent,'Mean source power':source,'Mean line loss':heat,'Mean load power':power,'Delivered load energy':power*40,'Line heat':heat*40,'Source work':source*40}))near(await value(label),expected);
  near(await value('Source work'),await value('Line heat')+await value('Delivered load energy'),.03);
  if(v.connected)near(await value('Efficiency'),power/source*100);else{assert.match(await reading('Efficiency'),/No delivery/i);assert.equal(await value('Load RMS voltage'),0);assert.equal(await value('Available consumer RMS voltage'),12);}
  outcomes.push({current,voltage,power,heat,source});await shot(`experiment-${i}`);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 assert.ok(outcomes[2].heat<outcomes[0].heat&&outcomes[0].heat<outcomes[1].heat);
 assert.ok(outcomes[5].power>outcomes[4].power&&outcomes[5].heat<outcomes[4].heat);assert.equal(outcomes[3].heat,0);
 await preset(0);await run();await finished();await page.locator('[data-result]').click();await shot('result');await run();await page.waitForTimeout(150);await run();assert.ok(await value('Simulated time')<40);
 for(const [key,next] of [['ratio','6'],['lineResistance','4'],['loadResistance','6'],['connected','0']]){
  await page.locator('[data-step]').click();assert.ok(await value('Simulated time')>0);
  if(['ratio','connected'].includes(key))await control(key).selectOption(next);else await control(key).fill(next);
  assert.equal(await value('Simulated time'),0);assert.equal(await value('Delivered load energy'),0);
 }
 await page.locator('[data-step]').click();assert.equal(await value('Line RMS current'),0);assert.equal(await value('Delivered load energy'),0);
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();
 for(const [key,expected] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),expected);
 assert.equal(await value('Simulated time'),0);assert.equal(await value('Delivered load energy'),0);
 await control('lineResistance').focus();await page.keyboard.press('ArrowUp');assert.equal(Number(await control('lineResistance').inputValue()),2.5);
 await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));await page.waitForFunction(()=>window.scrollY===0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,outcomes,checks:'eight full-state presets; four controls; solved delivery and line loss; open consumer voltage boundary; partial and final energy balance; pause/step/reset/replay/result/keyboard/quiz/mobile'},null,2));
}finally{await browser.close();}

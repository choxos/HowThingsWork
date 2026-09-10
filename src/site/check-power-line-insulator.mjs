import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {powerLineInsulatorLesson as lesson} from './power-line-insulator-lesson.js';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL('../../documentation/audit/evidence/power-line-insulator/',import.meta.url);
await mkdir(evidence,{recursive:true});
page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const value=async label=>parseFloat(await reading(label));
const control=key=>page.locator(`[data-${key==='voltage'?'number':'control'}="${key}"]`);
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true});
const run=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:90000});
const near=(actual,expected,tol=.025)=>assert.ok(Math.abs(actual-expected)<=tol,`${actual} differs from ${expected}`);
async function preset(i){
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();
 await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();
 await page.getByRole('tab',{name:'Controls',exact:true}).click();
 for(const [key,expected] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),expected);
 assert.equal(await value('Simulated time'),0);assert.equal(await value('Delivered consumer energy'),0);
}
async function checkBalance(v){
 const gl=v.connected/12,gs=v.insulation/12,node=v.voltage/(1+gl+gs),il=node*gl,is=node*gs,total=il+is;
 const pl=node*il,ps=node*is,pf=total*total,pin=v.voltage*total;
 for(const [label,expected] of Object.entries({'Source RMS voltage':v.voltage,'Supported node RMS voltage':node,'Consumer RMS voltage':v.connected?node:0,'Source RMS current':total,'Consumer RMS current':il,'Support RMS current':is,'Mean source power':pin,'Mean consumer power':pl,'Mean support-path power':ps,'Mean feeder loss':pf,'Source work':pin*40,'Delivered consumer energy':pl*40,'Support-path energy':ps*40,'Feeder heat':pf*40}))near(await value(label),expected);
 near(await value('Source work'),await value('Delivered consumer energy')+await value('Support-path energy')+await value('Feeder heat'),.001);
 return {node,loadCurrent:il,supportCurrent:is,loadPower:pl,loadEnergy:pl*40};
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/power-line-insulator`);
 await page.getByRole('heading',{name:'Power-line insulator',exact:true}).waitFor();await page.locator('.daily-readings').waitFor();
 assert.equal(await page.locator('[data-control]').count(),3);assert.equal(await page.locator('[data-number]').count(),1);await shot('initial');
 const outcomes=[];
 for(let i=0;i<lesson.tryIt.length;i++){
  await preset(i);
  if(i===0){
   await page.locator('[data-step]').click();near(await value('Electrical phase'),1,.01);
   await run();await page.waitForTimeout(350);await run();const held=await page.locator('.daily-readings').textContent();await page.waitForTimeout(250);assert.equal(await page.locator('.daily-readings').textContent(),held);
   const t=await value('Simulated time')/1000,factor=(t+Math.sin(200*Math.PI*t)/(200*Math.PI))*1000;
   for(const [energy,power] of [['Source work','Mean source power'],['Delivered consumer energy','Mean consumer power'],['Support-path energy','Mean support-path power'],['Feeder heat','Mean feeder loss']])near(await value(energy),await value(power)*factor,.2);
   await shot('paused');
  }
  await run();await finished();near(await value('Simulated time'),40,.001);near(await value('Electrical phase'),0,.01);
  outcomes.push(await checkBalance(lesson.tryIt[i].values));await shot('experiment-'+i);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 assert.ok(outcomes[1].loadPower<outcomes[0].loadPower);near(outcomes[1].loadCurrent,outcomes[1].supportCurrent,.00001);
 assert.equal(outcomes[2].loadEnergy,0);assert.ok(outcomes[2].supportCurrent>0);assert.equal(outcomes[3].node,12);assert.equal(outcomes[3].supportCurrent,0);assert.equal(outcomes[4].node,0);
 await preset(1);await run();await finished();await page.locator('[data-result]').click();await shot('result');await run();await page.waitForTimeout(150);await run();assert.ok(await value('Simulated time')<40);
 for(const [key,next] of [['voltage','24'],['insulation','0'],['connected','0']]){
  await page.locator('[data-step]').click();assert.ok(await value('Simulated time')>0);
  if(key==='voltage')await control(key).fill(next);else await control(key).selectOption(next);
  assert.equal(await value('Simulated time'),0);for(const label of ['Source work','Delivered consumer energy','Support-path energy','Feeder heat'])assert.equal(await value(label),0);
 }
 await control('insulation').selectOption('1');await control('connected').selectOption('1');await run();await finished();await checkBalance({voltage:24,insulation:1,connected:1});await shot('maximum-source');
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,expected] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),expected);assert.equal(await value('Delivered consumer energy'),0);
 await control('voltage').focus();await page.keyboard.press('ArrowUp');assert.equal(Number(await control('voltage').inputValue()),18);
 await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));await page.waitForFunction(()=>window.scrollY===0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,outcomes,checks:'five full-state presets; three controls; load versus support paths; source/node voltage; branch currents; source/load/support/feeder power and exact energy; open versus zero source; maximum24V; pause/step/reset/replay/result/keyboard/quiz/mobile'},null,2));
}finally{await browser.close();}

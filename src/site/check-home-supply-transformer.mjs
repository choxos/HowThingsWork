import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {homeSupplyTransformerLesson as lesson} from './home-supply-transformer-lesson.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL('../../documentation/audit/evidence/home-supply-transformer/',import.meta.url);
await mkdir(evidence,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const value=async label=>parseFloat(await reading(label));
const run=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:90000});
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true});
const near=(actual,expected,tol=.025)=>assert.ok(Math.abs(actual-expected)<=tol,`${actual} differs from ${expected}`);
const control=key=>page.locator(`[data-${key==='voltage'?'number':'control'}="${key}"]`);
async function preset(i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
const outcomes=[];
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/home-supply-transformer`);
 await page.getByRole('heading',{name:'Home-supply transformer',exact:true}).waitFor();await page.locator('.daily-readings').waitFor();
 assert.equal(await page.locator('[data-control]').count(),4);assert.equal(await page.locator('[data-number]').count(),1);await shot('initial');
 for(let i=0;i<lesson.tryIt.length;i++){
  await preset(i);const v=lesson.tryIt[i].values;
  for(const [key,expected] of Object.entries(v))assert.equal(Number(await control(key).inputValue()),expected);
  assert.equal(await value('Simulated time'),0);assert.equal(await value('Delivered home energy'),0);
  if(i===0){await page.locator('[data-step]').click();near(await value('Electrical phase'),1,.01);await run();await page.waitForTimeout(350);await run();const held=await page.locator('.daily-readings').textContent();await page.waitForTimeout(250);assert.equal(await page.locator('.daily-readings').textContent(),held);const t=await value('Simulated time')/1000;near(await value('Delivered home energy'),await value('Mean home power')*(t+Math.sin(200*Math.PI*t)/(200*Math.PI))*1000,.15);await shot('paused');}
  await run();await finished();near(await value('Simulated time'),40,.001);near(await value('Electrical phase'),0,.01);
  const home=v.voltage/3,n=v.branchA+v.branchB+v.branchC,I=n*home/12,power=n*home*home/12;
  for(const [label,expected] of Object.entries({'Incoming RMS voltage':v.voltage,'Available home RMS voltage':home,'Primary RMS current':I/3,'Total secondary RMS current':I,'Mean input power':power,'Mean home power':power,'Source work':40*power,'Delivered home energy':40*power}))near(await value(label),expected);
  assert.equal(await reading('Connected loads'),['A','B','C'].filter(id=>v[`branch${id}`]).join(', ')||'None');
  let branchEnergy=0;
  for(const id of ['A','B','C']){const connected=v[`branch${id}`],branchPower=connected*home*home/12;for(const [field,expected] of Object.entries({'RMS voltage':connected*home,'RMS current':connected*home/12,'mean power':branchPower,'energy':40*branchPower}))near(await value(`Load ${id} ${field}`),expected);branchEnergy+=await value(`Load ${id} energy`);}
  near(await value('Delivered home energy'),branchEnergy,.001);near(await value('Source work'),branchEnergy,.001);assert.match(await reading('Fixed turns'),/12\s*:\s*4/);
  if(!v.voltage||!n){assert.equal(await value('Mean home power'),0);assert.equal(await value('Delivered home energy'),0);}if(!n)assert.equal(await value('Available home RMS voltage'),6);
  outcomes.push({home,n,current:I,power,energy:40*power});await shot(`experiment-${i}`);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 assert.equal(outcomes[1].home,outcomes[0].home);assert.equal(outcomes[1].power,3*outcomes[0].power);assert.equal(outcomes[2].power,outcomes[0].power);assert.equal(outcomes[4].power,4);
 await preset(0);await run();await finished();await page.locator('[data-result]').click();await shot('result');await run();await page.waitForTimeout(150);await run();assert.ok(await value('Simulated time')<40);
 for(const [key,next] of [['voltage','24'],['branchA','0'],['branchB','1'],['branchC','1']]){await page.locator('[data-step]').click();assert.ok(await value('Simulated time')>0);if(key==='voltage')await control(key).fill(next);else await control(key).selectOption(next);assert.equal(await value('Simulated time'),0);assert.equal(await value('Delivered home energy'),0);}
 await control('branchB').selectOption('0');await page.locator('[data-step]').click();assert.equal(await value('Load A energy'),0);assert.equal(await value('Load B energy'),0);assert.ok(await value('Load C energy')>0);
 await control('voltage').fill('36');await control('branchA').selectOption('1');await control('branchB').selectOption('1');await run();await finished();near(await value('Available home RMS voltage'),12);near(await value('Total secondary RMS current'),3);near(await value('Mean home power'),36);near(await value('Delivered home energy'),1440);await shot('maximum-demand');
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,expected] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),expected);assert.equal(await value('Delivered home energy'),0);
 await control('voltage').focus();await page.keyboard.press('ArrowUp');assert.equal(Number(await control('voltage').inputValue()),24);
 await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));await page.waitForFunction(()=>window.scrollY===0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,outcomes,checks:'six full-state presets; four controls; each physical branch identity; fixed-voltage parallel demand; primary/secondary/branch power and energy; open-load versus source-off; maximum demand; pause/step/reset/replay/result/keyboard/quiz/mobile'},null,2));
}finally{await browser.close();}

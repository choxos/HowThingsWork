import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {transmissionTransformerLesson as lesson} from './transmission-transformer-lesson.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL('../../documentation/audit/evidence/transmission-transformer/',import.meta.url);
await mkdir(evidence,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const value=async label=>parseFloat(await reading(label));
const run=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:90000});
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true});
const near=(actual,expected,tol=.025)=>assert.ok(Math.abs(actual-expected)<=tol,`${actual} differs from ${expected}`);
async function preset(i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
const outcomes=[];
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/transmission-transformer`);
 await page.getByRole('heading',{name:'Transmission transformer',exact:true}).waitFor();await page.locator('.daily-readings').waitFor();
 assert.equal(await page.locator('[data-control]').count(),2);assert.equal(await page.locator('[data-number]').count(),0);await shot('initial');
 for(let i=0;i<lesson.tryIt.length;i++){
  await preset(i);const v=lesson.tryIt[i].values;
  for(const [key,expected] of Object.entries(v))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),expected);
  assert.equal(await page.locator('.daily-part-path [data-parent="sending"]').textContent(),'Sending transformer');
  assert.equal(await value('Simulated time'),0);assert.equal(await value('Transferred energy'),0);
  if(i===0){await page.locator('[data-step]').click();near(await value('Electrical phase'),1,.01);await run();await page.waitForTimeout(350);await run();const held=await page.locator('.daily-readings').textContent();await page.waitForTimeout(250);assert.equal(await page.locator('.daily-readings').textContent(),held);const t=await value('Simulated time')/1000;near(await value('Transferred energy'),await value('Mean input power')*(t+Math.sin(200*Math.PI*t)/(200*Math.PI))*1000,.15);await shot('paused');}
  await run();await finished();near(await value('Simulated time'),40,.001);near(await value('Electrical phase'),0,.01);
  const a=v.ratio,I=v.connected?12*a/(2+12*a*a):0,primary=a*I,power=12*primary,heat=2*I*I,load=12*primary*primary;
  for(const [label,expected] of Object.entries({'Primary RMS voltage':12,'Secondary RMS voltage':12*a,'Primary RMS current':primary,'Secondary RMS current':I,'Mean input power':power,'Mean output power':power,'Transferred energy':40*power,'Delivered load energy':40*load,'Line heat':40*heat}))near(await value(label),expected);
  near(await value('Primary RMS voltage')*await value('Primary RMS current'),await value('Secondary RMS voltage')*await value('Secondary RMS current'),.01);
  near(await value('Transferred energy'),await value('Delivered load energy')+await value('Line heat'),.003);
  assert.match(await reading('Actual sending turns'),new RegExp(`4\\s*:\\s*${4*a}`));
  if(!v.connected){assert.equal(await value('Mean output power'),0);assert.equal(await value('Transferred energy'),0);assert.equal(await value('Secondary RMS voltage'),36);}
  outcomes.push({ratio:a,primaryCurrent:primary,secondaryCurrent:I,power,transferredEnergy:40*power});await shot(`experiment-${i}`);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 assert.ok(outcomes[2].power>outcomes[0].power&&outcomes[0].power>outcomes[1].power);assert.ok(outcomes[2].secondaryCurrent<outcomes[0].secondaryCurrent&&outcomes[0].secondaryCurrent<outcomes[1].secondaryCurrent);
 await preset(0);await run();await finished();await page.locator('[data-result]').click();assert.equal(await page.locator('.daily-part-path [data-parent="sending"]').textContent(),'Sending transformer');await shot('result');await run();await page.waitForTimeout(150);await run();assert.ok(await value('Simulated time')<40);
 for(const [key,next] of [['ratio','6'],['connected','0']]){await page.locator('[data-step]').click();assert.ok(await value('Simulated time')>0);await page.locator(`[data-control="${key}"]`).selectOption(next);assert.equal(await value('Simulated time'),0);assert.equal(await value('Transferred energy'),0);}
 await page.locator('[data-step]').click();assert.equal(await value('Mean input power'),0);assert.equal(await value('Mean output power'),0);
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,expected] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),expected);assert.equal(await value('Transferred energy'),0);
 await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));await page.waitForFunction(()=>window.scrollY===0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,outcomes,checks:'four full-state presets; two controls; sending focus; reciprocal port voltage/current and equal power; transferred versus delivered energy; open-load induced voltage; pause/step/reset/replay/result/quiz/mobile'},null,2));
}finally{await browser.close();}

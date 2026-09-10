import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {contactBreakerIgnitionLesson as lesson} from './contact-breaker-ignition-lesson.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL('../../documentation/audit/evidence/contact-breaker-ignition/',import.meta.url);await mkdir(evidence,{recursive:true});
page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const value=async label=>parseFloat(await reading(label));
const control=key=>page.locator(`[data-control="${key}"]`),number=key=>page.locator(`[data-number="${key}"]`);
const near=(a,b,tolerance=.0001)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);
const play=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:90000});
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true});
const inspect=()=>page.getByRole('button',{name:'Inspect the first-opening stage (63°)',exact:true}).click();
async function energy(label){const text=await reading(label),n=parseFloat(text);assert.ok(Number.isFinite(n),`${label}: ${text}`);return /mJ/.test(text)?n/1000:n;}
async function preset(i){
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
 for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);
 assert.equal(await value('Observation progress'),0);assert.equal(await value('Contact openings'),0);assert.match(await reading('First opening time'),/No opening recorded/);near(await energy('Ignition battery work'),0);
}
async function budget(){
 const e={};for(const label of ['Ignition battery work','Stored magnetic energy','Stored capacitor energy','Winding heat','Points heat','Delivered spark energy'])e[label]=await energy(label);
 near(e['Ignition battery work'],e['Stored magnetic energy']+e['Stored capacitor energy']+e['Winding heat']+e['Points heat']+e['Delivered spark energy'],.000005);return e;
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/contact-breaker-ignition`);await page.getByRole('heading',{name:'Contact-breaker ignition',exact:true}).waitFor();await page.locator('.daily-readings').waitFor();
 assert.equal(await page.locator('[data-control]').count(),3);assert.equal(await page.locator('[data-number]').count(),2);assert.equal(await page.locator('select[data-control]').count(),1);await shot('initial');
 const outcomes=[];
 for(let i=0;i<lesson.tryIt.length;i++){
  await preset(i);
  if(i===0){
   await page.locator('[data-step]').click();assert.ok(await value('Observation progress')>0);assert.equal(await value('Contact openings'),0);assert.ok(await energy('Ignition battery work')>0);
   await play();await page.waitForTimeout(150);await play();const held=await page.locator('.daily-readings').textContent();await page.waitForTimeout(200);assert.equal(await page.locator('.daily-readings').textContent(),held);
  }
  await inspect();near(await value('Observation progress'),17.5,.06);assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Points, cam and parallel capacitor');
  for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);
  const normal=lesson.tryIt[i].values.points===0;
  assert.equal(await value('Contact openings'),normal?1:0);
  near(await value('Primary current'),await value('Points current')+await value('Points capacitor current'),.00003);
  if(normal){
   assert.match(await reading('Points state'),/^Open$/);near(await value('Points current'),0);near(await value('First opening time'),10000/lesson.tryIt[i].values.rpm,.001);
   if(lesson.tryIt[i].values.voltage>0){assert.ok(await value('High-voltage node')>250);assert.ok(await energy('Delivered spark energy')>0);}else{near(await value('High-voltage node'),0);near(await energy('Delivered spark energy'),0);}
  }else assert.match(await reading('Current at first opening'),/No opening recorded/);
  await budget();await shot('opening-stage-'+i);
  const first=await reading('Current at first opening');await play();await finished();assert.equal(await reading('Current at first opening'),first);
  assert.equal(await value('Contact openings'),normal?4:0);near(await value('Observation progress'),100);
  outcomes.push({openings:await value('Contact openings'),current:normal?await value('Current at first opening'):null,magnetic:normal?await energy('Magnetic energy at first opening'):null,sparks:await value('Spark events'),energy:await budget()});
  await shot('experiment-'+i);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 near(outcomes[0].current,2.938164703855441,.00002);near(outcomes[0].magnetic,.1295721405163802,.000002);
 near(outcomes[1].current,2.129430832726253,.00002);near(outcomes[1].magnetic,.06817380409782964,.000002);
 near(outcomes[2].current,outcomes[0].current/2,.00002);near(outcomes[2].magnetic,outcomes[0].magnetic/4,.000002);
 assert.ok(outcomes[1].magnetic<outcomes[0].magnetic);assert.equal(outcomes[0].sparks,8);assert.equal(outcomes[1].sparks,4);assert.equal(outcomes[2].sparks,5);
 for(const i of [3,4,5]){assert.equal(outcomes[i].sparks,0);near(outcomes[i].energy['Delivered spark energy'],0);}
 assert.ok(outcomes[3].energy['Stored magnetic energy']>.17);assert.ok(outcomes[4].energy['Stored capacitor energy']>0);near(outcomes[5].energy['Ignition battery work'],0);near(outcomes[5].magnetic,0);near(outcomes[5].current,0);
 await preset(0);await inspect();await play();await finished();await page.locator('[data-result]').click();await shot('result');
 await play();await page.waitForTimeout(150);await play();assert.ok(await value('Observation progress')<100);assert.equal(await value('Contact openings'),0);
 for(const [key,next] of [['voltage','9'],['rpm','120'],['points','2']]){
  await inspect();if(key==='points')await control(key).selectOption(next);else await number(key).fill(next);
  assert.equal(await value('Observation progress'),0);assert.equal(await value('Contact openings'),0);assert.match(await reading('Magnetic energy at first opening'),/No opening recorded/);near(await energy('Ignition battery work'),0);
 }
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),n);
 await number('voltage').focus();await page.keyboard.press('ArrowDown');assert.equal(Number(await number('voltage').inputValue()),9);
 await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,outcomes,checks:'six complete presets; three controls; exact first-opening records; independent contact/spark counts; current partition; passive energy; same-settings opening inspection; pause/step/reset/edit/replay/result/keyboard/quiz/mobile'},null,2));
}finally{await browser.close();}

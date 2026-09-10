import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {carIgnitionLesson as lesson} from './car-ignition-lesson.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL('../../documentation/audit/evidence/car-ignition/',import.meta.url);await mkdir(evidence,{recursive:true});
page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const value=async label=>parseFloat(await reading(label));
const control=key=>page.locator(`[data-control="${key}"]`);
const number=key=>page.locator(`[data-number="${key}"]`);
const near=(actual,expected,tolerance=.02)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);
const run=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:90000});
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true});
async function energy(label){const text=await reading(label),n=parseFloat(text);assert.ok(Number.isFinite(n),`${label}: ${text}`);return /mJ/.test(text)?n/1000:n;}
async function preset(i){
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
 for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);
 assert.equal(await value('Observation progress'),0);assert.equal(await value('Spark events'),0);near(await energy('Total battery work'),0,1e-8);
}
async function outcome(){
 const e={};for(const label of ['Stored magnetic energy','Stored capacitor energy','Ignition battery work','Winding heat','Points heat','Delivered spark energy','Solenoid energy','Starter energy','Total battery work'])e[label]=await energy(label);
 const plugs=[];for(const label of ['A','B','C','D'])plugs.push(await energy(`Plug ${label} energy`));
 near(plugs.reduce((a,b)=>a+b,0),e['Delivered spark energy'],.00002);
 near(e['Ignition battery work'],e['Stored magnetic energy']+e['Stored capacitor energy']+e['Winding heat']+e['Points heat']+e['Delivered spark energy'],.00005);
 near(e['Total battery work'],e['Ignition battery work']+e['Solenoid energy']+e['Starter energy'],.00005);
 near(await value('Observation progress'),100);
 return {energy:e,plugs,events:await value('Spark events'),sequence:await reading('Spark sequence'),angle:await value('Shaft angle'),control:await value('Solenoid current'),starter:await value('Starter current')};
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/car-ignition-system`);await page.getByRole('heading',{name:'Car ignition system',exact:true}).waitFor();await page.locator('.daily-readings').waitFor();
 assert.equal(await page.locator('[data-control]').count(),4);assert.equal(await page.locator('[data-number]').count(),2);assert.equal(await page.locator('select[data-control]').count(),2);await shot('initial');
 const outcomes=[];
 for(let i=0;i<lesson.tryIt.length;i++){
  await preset(i);
  if(i===0){
   await page.locator('[data-step]').click();assert.ok(await value('Observation progress')>0);assert.ok(await energy('Ignition battery work')>0);assert.equal(await value('Spark events'),0);
   await run();await page.waitForTimeout(250);await run();const held=await page.locator('.daily-readings').textContent();await page.waitForTimeout(250);assert.equal(await page.locator('.daily-readings').textContent(),held);await shot('paused-charge');
  }
  await run();await finished();outcomes.push(await outcome());await shot('experiment-'+i);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 assert.equal(outcomes[0].events,8);assert.equal(outcomes[1].events,5);assert.equal(outcomes[2].events,4);assert.ok(outcomes[0].plugs.every(e=>e>0));
 near(outcomes[0].energy['Delivered spark energy'],.319859766,.000005);near(outcomes[1].energy['Delivered spark energy'],.067901288,.000005);near(outcomes[2].energy['Delivered spark energy'],.139749688,.000005);
 assert.ok(outcomes[1].energy['Delivered spark energy']<outcomes[0].energy['Delivered spark energy']);assert.ok(outcomes[2].energy['Delivered spark energy']<outcomes[0].energy['Delivered spark energy']);
 for(const i of [3,4,6,7,8]){assert.equal(outcomes[i].events,0);near(outcomes[i].energy['Delivered spark energy'],0,1e-8);}
 assert.ok(outcomes[4].energy['Stored magnetic energy']>0);assert.equal(outcomes[0].starter,0);near(outcomes[5].control,.5,.00001);near(outcomes[5].starter,40,.00001);near(outcomes[6].control,.125,.00001);assert.equal(outcomes[6].starter,0);assert.equal(outcomes[6].angle,0);
 near(outcomes[5].energy['Solenoid energy'],.6,.00002);near(outcomes[5].energy['Starter energy'],48,.00002);
 for(const i of [7,8])near(outcomes[i].energy['Total battery work'],0,1e-8);
 await preset(0);await run();await finished();await page.locator('[data-result]').click();await shot('result');await run();await page.waitForTimeout(150);await run();assert.ok(await value('Observation progress')<100);assert.equal(await value('Spark events'),0);
 for(const [key,next] of [['voltage','9'],['rpm','120'],['key','2'],['points','2']]){
  await page.locator('[data-step]').click();assert.ok(await value('Observation progress')>0);
  if(key==='key'||key==='points')await control(key).selectOption(next);else await number(key).fill(next);
  assert.equal(await value('Observation progress'),0);assert.equal(await value('Spark events'),0);near(await energy('Total battery work'),0,1e-8);
 }
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),n);
 await number('voltage').focus();await page.keyboard.press('ArrowDown');assert.equal(Number(await number('voltage').inputValue()),9);
 await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,outcomes,checks:'nine complete presets; four controls; charge and actual spark records; plug and total energy balance; voltage/dwell/points/start/off/zero-source comparisons; pause/step/reset/edit/replay/result/keyboard/quiz/mobile'},null,2));
}finally{await browser.close();}

import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {distributionTransformerLesson as lesson} from './distribution-transformer-lesson.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL('../../documentation/audit/evidence/distribution-transformer/',import.meta.url);
await mkdir(evidence,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const value=async label=>parseFloat(await reading(label));
const run=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:90000});
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true});
const near=(actual,expected,tol=.025)=>assert.ok(Math.abs(actual-expected)<=tol,`${actual} differs from ${expected}`);
const control=key=>page.locator(`[data-${key==='loadResistance'?'number':'control'}="${key}"]`);
async function preset(i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
const outcomes=[];
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/distribution-transformer`);
 await page.getByRole('heading',{name:'Distribution transformer',exact:true}).waitFor();await page.locator('.daily-readings').waitFor();
 assert.equal(await page.locator('[data-control]').count(),3);assert.equal(await page.locator('[data-number]').count(),1);await shot('initial');
 for(let i=0;i<lesson.tryIt.length;i++){
  await preset(i);const v=lesson.tryIt[i].values;
  for(const [key,expected] of Object.entries(v))assert.equal(Number(await control(key).inputValue()),expected);
  assert.match(await page.locator('.daily-part-path [data-parent="receiving"]').textContent(),/Distribution|Receiving/);
  assert.equal(await value('Simulated time'),0);assert.equal(await value('Transferred energy'),0);
  if(i===0){await page.locator('[data-step]').click();near(await value('Electrical phase'),1,.01);await run();await page.waitForTimeout(350);await run();const held=await page.locator('.daily-readings').textContent();await page.waitForTimeout(250);assert.equal(await page.locator('.daily-readings').textContent(),held);const t=await value('Simulated time')/1000;near(await value('Transferred energy'),await value('Mean input power')*(t+Math.sin(200*Math.PI*t)/(200*Math.PI))*1000,.15);await shot('paused');}
  await run();await finished();near(await value('Simulated time'),40,.001);near(await value('Electrical phase'),0,.01);
  const a=v.ratio,L=v.loadResistance,I=v.connected?12*a/(2+L*a*a):0,primaryVoltage=12*a-2*I,secondaryVoltage=primaryVoltage/a,secondaryCurrent=a*I,power=L*secondaryCurrent*secondaryCurrent,heat=2*I*I,source=12*secondaryCurrent;
  for(const [label,expected] of Object.entries({'Primary RMS voltage':primaryVoltage,'Secondary RMS voltage':secondaryVoltage,'Primary RMS current':I,'Secondary RMS current':secondaryCurrent,'Mean input power':power,'Mean output power':power,'Transferred energy':40*power,'Regional load RMS voltage':v.connected?secondaryVoltage:0,'Regional load power':power,'Regional load energy':40*power,'Upstream line heat':40*heat,'Source work':40*source}))near(await value(label),expected);
  near(await value('Primary RMS voltage')*await value('Primary RMS current'),await value('Secondary RMS voltage')*await value('Secondary RMS current'),.01);
  near(await value('Transferred energy'),await value('Regional load energy'),.001);near(await value('Source work'),await value('Transferred energy')+await value('Upstream line heat'),.003);
  assert.match(await reading('Actual receiving turns'),new RegExp(`${4*a}\\s*:\\s*4`));
  if(!v.connected){assert.equal(await value('Secondary RMS voltage'),12);assert.equal(await value('Regional load RMS voltage'),0);assert.equal(await value('Mean input power'),0);assert.equal(await value('Transferred energy'),0);}
  outcomes.push({ratio:a,primaryVoltage,secondaryVoltage,primaryCurrent:I,secondaryCurrent,power,transferredEnergy:40*power});await shot(`experiment-${i}`);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 assert.ok(outcomes[3].secondaryCurrent>outcomes[0].secondaryCurrent&&outcomes[3].secondaryVoltage<outcomes[0].secondaryVoltage&&outcomes[3].power>outcomes[0].power);
 await preset(0);await run();await finished();await page.locator('[data-result]').click();assert.match(await page.locator('.daily-part-path [data-parent="receiving"]').textContent(),/Distribution|Receiving/);await shot('result');await run();await page.waitForTimeout(150);await run();assert.ok(await value('Simulated time')<40);
 for(const [key,next] of [['ratio','6'],['loadResistance','24'],['connected','0']]){await page.locator('[data-step]').click();assert.ok(await value('Simulated time')>0);if(key==='loadResistance')await control(key).fill(next);else await control(key).selectOption(next);assert.equal(await value('Simulated time'),0);assert.equal(await value('Transferred energy'),0);}
 await page.locator('[data-step]').click();assert.equal(await value('Mean output power'),0);assert.equal(await value('Secondary RMS voltage'),12);assert.equal(await value('Regional load RMS voltage'),0);
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,expected] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),expected);assert.equal(await value('Transferred energy'),0);
 await control('loadResistance').focus();await page.keyboard.press('ArrowUp');assert.equal(Number(await control('loadResistance').inputValue()),14);
 await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));await page.waitForFunction(()=>window.scrollY===0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,outcomes,checks:'five full-state presets; three controls; receiving focus; reciprocal voltage/current and equal local power; transferred/regional energy excludes upstream heat; open available versus load voltage; pause/step/reset/replay/result/keyboard/quiz/mobile'},null,2));
}finally{await browser.close();}

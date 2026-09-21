import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {sensorsAndDetectorsLesson as lesson} from './sensors-and-detectors-lesson.js';
import {sampleSensor} from './sensors-and-detectors-model.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL(process.env.SENSOR_EVIDENCE||'../../documentation/audit/evidence/sensors-and-detectors/',import.meta.url);await mkdir(evidence,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const value=async label=>parseFloat(await reading(label)),control=key=>page.locator(`[data-control="${key}"]`),number=key=>page.locator(`[data-number="${key}"]`);
const displayed=n=>Math.abs(n)<1e-6?0:Number(n.toPrecision(3));
const near=(a,b,tolerance=.00001)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`),play=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:60000});
const nextFrames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))));
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true});
const stages=['Inspect initial state (0 s)','Inspect early response (0.05 s)','Inspect settling response (0.2 s)','Inspect final response (3 s)'];
const inspect=i=>page.getByRole('button',{name:stages[i],exact:true}).click();
async function preset(i){
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
 for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);
 near(await value('Observation progress'),0);near(await value('Additional spring compression'),0);
}
async function response(){return {compression:await value('Additional spring compression'),voltage:await value('Wiper output'),indication:await reading('Indicated load'),detector:await reading('Detector'),time:await value('Observation time'),progress:await value('Observation progress')};}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/sensors-and-detectors`);await page.getByRole('heading',{name:'Sensors and detectors',exact:true}).waitFor();await page.locator('.daily-readings').waitFor();
 assert.equal(await page.locator('[data-control]').count(),4);assert.equal(await page.locator('.daily-readings>div p').count(),15);await shot('initial');await page.getByRole('checkbox',{name:'Look inside',exact:true}).uncheck();await shot('exterior');await page.getByRole('checkbox',{name:'Look inside',exact:true}).check();
 const outcomes=[],transients=[];
 for(let i=0;i<lesson.tryIt.length;i++){
  await preset(i);
  if(i===0){
   await page.locator('[data-step]').click();near(await value('Observation progress'),1,.051);await play();await nextFrames();await play();const paused=await page.locator('.daily-readings').textContent();await nextFrames();assert.equal(await page.locator('.daily-readings').textContent(),paused);
  }
  for(let j=0;j<4;j++){
   await inspect(j);near(await value('Observation time'),[0,.05,.2,3][j],.00001);
   for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);
   if(i===0){transients.push(await response());await shot('stage-'+j);}
  }
  outcomes.push(await response());await shot('experiment-'+i);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 assert.ok(transients[0].compression===0&&transients[1].compression>0&&transients[2].compression>transients[1].compression&&transients[3].compression>transients[2].compression);
 for(const [i,o] of outcomes.entries()){
  const v=lesson.tryIt[i].values,expected=sampleSensor(v,3);near(o.compression,displayed(expected.compression*1000));near(o.voltage,displayed(expected.outputVoltage));near(o.progress,100);near(o.time,3);
  if(v.supply===0){assert.match(o.indication,/unavailable/i);assert.match(o.detector,/unpowered/i);}else{near(parseFloat(o.indication),v.mass+v.zero,.00001);assert.match(o.detector,[0,3,6].includes(i)?/^off/i:/^on/i);}
 }
 near(outcomes[0].voltage,outcomes[1].voltage);near(outcomes[0].compression,outcomes[4].compression);assert.equal(outcomes[0].voltage,1.63);assert.equal(outcomes[3].voltage,.817);near(parseFloat(outcomes[0].indication),parseFloat(outcomes[3].indication));near(outcomes[0].voltage,outcomes[5].voltage);
 await preset(0);await play();await finished();near(await value('Observation progress'),100);await page.locator('[data-result]').click();await shot('result');await play();await nextFrames();await play();assert.ok(await value('Observation progress')<100);const paused=await page.locator('.daily-readings').textContent();await nextFrames();assert.equal(await page.locator('.daily-readings').textContent(),paused);
 for(const [key,next] of [['mass','5'],['supply','2.5'],['threshold','0'],['zero','-1']]){await inspect(2);await number(key).fill(next);near(await value('Observation progress'),0);near(await value('Additional spring compression'),0);}
 await number('mass').fill('0');await number('supply').fill('5');await number('threshold').fill('1');await number('zero').fill('1');near(await value('Indicated load'),1);assert.match(await reading('Detector'),/^on/i);
 await number('zero').fill('.75');assert.match(await reading('Detector'),/^off/i);await number('zero').fill('-1');near(await value('Indicated load'),-1);
 await preset(0);await number('threshold').fill('2');await inspect(3);near(await value('Indicated load'),2);assert.match(await reading('Detector'),/^off/i);assert.equal(await reading('Threshold comparison'),'Just below threshold · rounded reading');
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),n);
 await number('mass').focus();await page.keyboard.press('ArrowUp');assert.equal(Number(await number('mass').inputValue()),2.5);await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});await preset(4);await inspect(3);await page.evaluate(()=>window.scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile-unpowered');assert.match(await reading('Indicated load'),/unavailable/i);await preset(5);await inspect(3);await shot('mobile-biased');assert.match(await reading('Detector'),/^on/i);assert.deepEqual(errors,[]);
 await page.goto('about:blank');await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/sensors-and-detectors?part=spring-cover`);await page.locator('.daily-readings').waitFor();assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Removable spring guard');assert.equal(await page.locator('[data-cutaway]').isChecked(),false);await page.locator('[data-labels]').check();assert.equal(await page.locator('button[data-label-part="spring-cover"]').isVisible(),true);await shot('cover-bookmark');await page.locator('h1').click();assert.equal(await page.locator('.daily-part-detail h3').count(),0);
 const report={passed:true,outcomes,transients,checks:'seven presets;four stages;all controls;connected mechanical and electrical response;zero-power indication;exact and rounded threshold equality;negative offset;pause/step/reset/edit/replay/result/keyboard/quiz/mobile;guard bookmark reveals selected cover'};
 await writeFile(new URL('browser-results.json',evidence),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}

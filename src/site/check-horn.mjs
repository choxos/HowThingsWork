import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHornModel} from './horn-model.js';
import {hornLesson} from './horn-lesson.js';
const expected=hornLesson.tryIt.map(preset=>{const m=createHornModel();m.update(preset.values);for(let i=0;i<24;i++)m.playback.step();const active=m.getState().readings;while(!m.getState().complete)m.advance(.2);const final=m.getState().readings;m.dispose();return {active,final};});
const base=process.env.SITE_URL||'http://127.0.0.1:5193/',evidence=process.env.EVIDENCE_DIR||'documentation/audit/evidence/electric-horn-20260919/local';await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],cases=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 const Native=window.AudioContext;window.hornAudio={contexts:[],peak:0,recent:0};
 window.AudioContext=class extends Native{constructor(...args){super(...args);window.hornAudio.contexts.push(this);const analyser=this.createAnalyser();analyser.connect(this.destination);const buffer=new Float32Array(analyser.fftSize);const timer=setInterval(()=>{if(this.state==='closed'){clearInterval(timer);return;}analyser.getFloatTimeDomainData(buffer);window.hornAudio.recent=Math.max(...buffer.map(Math.abs));window.hornAudio.peak=Math.max(window.hornAudio.peak,window.hornAudio.recent);},10);const createGain=this.createGain.bind(this);this.createGain=()=>{const gain=createGain(),connect=gain.connect.bind(gain);gain.connect=target=>connect(target===this.destination?analyser:target);return gain;};}};
});
const reading=label=>page.locator('.daily-readings>div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd').textContent();
const play=page.locator('[data-play]'),detail=page.locator('.daily-part-detail');
const finish=()=>page.locator('[data-play][title^="Play again"]').waitFor({timeout:30000});
const shot=async name=>{await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/${name}.png`,clip:await page.locator('canvas').boundingBox()});};
try{
 await page.goto(`${base}#machine/electric-horn`);await page.getByRole('heading',{name:'Electric horn',exact:true}).waitFor();
 assert.equal(await page.locator('.house-breadcrumbs a[href="#place/workshop"]').count(),1);assert.equal(await page.locator('.house-breadcrumbs a[href="#place/home"]').count(),0);
 assert.equal(await page.evaluate(()=>window.hornAudio.contexts.length),0,'sound requires opt-in');
 await page.locator('[data-control="sound"]').selectOption('1');await play.click();await page.waitForFunction(()=>window.hornAudio.recent>.001);
 await play.click();await page.waitForTimeout(180);assert.ok(await page.evaluate(()=>window.hornAudio.recent<.00001),'pause silences actual output');assert.equal(await reading('Horn sound'),'Paused · sound off');
 const frozen=await reading('Time since press');await page.waitForTimeout(150);assert.equal(await reading('Time since press'),frozen);await page.locator('[data-step]').click();await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>window.hornAudio.recent<.00001),'step stays silent');
 await play.click();await page.waitForFunction(()=>window.hornAudio.recent>.001);await finish();await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>window.hornAudio.recent<.00001),'completion silences actual output');assert.match(await reading('Your result'),/9 diaphragm cycles/);assert.match(await detail.textContent(),/Connected electric horn/);
 await play.click();assert.equal(await page.locator('[data-control="sound"]').inputValue(),'0');await finish();assert.ok(await page.evaluate(()=>window.hornAudio.recent<.00001),'replay stays muted');
 console.log('PASS actual audio: opt-in waveform, correct paused status, pause/step/completion silence and muted replay.');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===1440?1000:844});await page.goto(`${base}#machine/electric-horn`);await page.reload();await page.getByRole('heading',{name:'Electric horn',exact:true}).waitFor();assert.match(await page.title(),/^Electric horn/);
  for(const [index,preset] of hornLesson.tryIt.entries()){
   await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(index).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
   for(const [key,value] of Object.entries(preset.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));assert.equal(await reading('Time since press'),'0.00 ms');assert.equal(await page.locator('[data-isolate]').isChecked(),false);await shot(`initial-${width}-${index}`);
   for(let i=0;i<24;i++)await page.locator('[data-step]').click();for(const label of ['Time since press','Diaphragm cycles','Contact breaks','Vibration frequency','Center movement','Pole air gap','Coil current','Interrupter'])assert.equal(await reading(label),expected[index].active.find(r=>r.label===label).value);await shot(`active-${width}-${index}`);
   await play.click();await finish();for(const label of ['Time since press','Diaphragm cycles','Contact breaks','Vibration frequency','Center movement','Pole air gap','Your result'])assert.equal(await reading(label),expected[index].final.find(r=>r.label===label).value);assert.match(await detail.textContent(),/Connected electric horn/);await shot(`final-${width}-${index}`);
   cases.push({width,title:preset.title,cycles:await reading('Diaphragm cycles'),frequency:await reading('Vibration frequency'),time:await reading('Time since press')});await page.locator('[data-reset-controls]').click();assert.equal(await reading('Time since press'),'0.00 ms');console.log(width,preset.title);
  }
  await page.locator('[data-labels]').check();await page.locator('button[data-label-part="moving-bar"]').click();assert.match(await detail.textContent(),/Moving iron bar/);await page.getByRole('heading',{name:'Electric horn',exact:true}).click();assert.match(await detail.textContent(),/Select a part/);await page.locator('[data-labels]').uncheck();
  await page.locator('[data-separation]').fill('100');await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await shot(`separated-${width}`);await page.getByRole('button',{name:'Reassemble',exact:true}).click();assert.match(page.url(),/#machine\/electric-horn$/);
  await page.getByRole('button',{name:hornLesson.quiz.options[1],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/Try thinking/);await page.getByRole('button',{name:hornLesson.quiz.options[0],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 await page.getByRole('button',{name:'Back to The workshop',exact:true}).click();await page.waitForURL('**#place/workshop');await page.waitForFunction(()=>window.hornAudio.contexts.every(context=>context.state==='closed'));
 await page.getByRole('searchbox',{name:'Find a machine or idea',exact:true}).fill('Electric horn');await page.getByRole('button',{name:'Electric horn',exact:true}).click();await page.getByRole('heading',{name:'Electric horn',exact:true}).waitFor();await page.goto(`${base}#list`);
 const row=page.locator('[data-entry="electric-horn"]').locator('xpath=ancestor::tr');for(const id of ['horn-make-and-break-contacts','electric-horn-moving-iron-bar','vibrating-horn-diaphragm'])assert.equal(await row.locator(`[data-entry="${id}"]`).count(),0);assert.equal(await row.locator('a[data-part-link]').count(),0);await row.locator('[data-entry="electric-horn"]').click();await page.getByRole('heading',{name:'Electric horn',exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS horn browser: twelve desktop/phone presets, measured readings, completion, reset, quiz, labels/dismissal, separation, zoom-only buttons, explicit workshop exit, catalog groups without ordinary part entries.');
}catch(error){await page.screenshot({path:`${evidence}/failure.png`,fullPage:true}).catch(()=>{});throw error;}
finally{await writeFile(`${evidence}/browser.json`,JSON.stringify({base,browser:browser.version(),cases,errors},null,2)+'\n');await browser.close();}

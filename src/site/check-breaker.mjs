import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createBreakerModel} from './breaker-model.js';
import {safetyLessons} from './safety-lessons.js';
import {chromium} from 'playwright';

const lesson=safetyLessons['Circuit breaker'];
const out=process.env.EVIDENCE_DIR||'documentation/audit/evidence/circuit-breaker-presets-20260919';
await mkdir(out,{recursive:true});
const model=createBreakerModel(),observations=[];
const reset=(values={},initialState)=>{model.reset(initialState);model.update({...model.defaults,...values});};
const close=(actual,expected,message)=>assert(Math.abs(actual-expected)<1e-9,`${message}: ${actual} != ${expected}`);
const part=id=>model.parts.find(part=>part.id===id).object;
let combinations=0;
for(const supply of [0,1])for(let resistance=6;resistance<=48;resistance+=.5){
 reset({supply,resistance});const current=supply?12/(resistance+.2):0;
 close(model.getState().current,current,'Closed circuit current');
 model.advance(2);const state=model.getState(),overload=current>1.5;
 assert.equal(state.tripped,overload);assert.equal(state.complete,overload);
 close(state.angle,overload?.85:0,'Spring opening');close(state.pull,0,'Core returns');
 close(state.current,overload?0:current,'Interrupted circuit');
 close(part('contact').rotation.z,state.angle,'Contact geometry follows opening');
 close(part('plunger').position.x,-state.pull,'Core geometry follows withdrawal');
 assert.equal(model.root.getObjectByProperty('isPointLight',true).intensity>0,state.current>0);
 combinations++;
}
reset({resistance:6});model.advance(.2);assert(model.getState().pull>0);assert.equal(model.getState().angle,0);assert(model.getState().current>0);
model.advance(.2);assert(model.getState().pull<.22);model.update({supply:0});model.advance(.4);
assert.equal(model.getState().pull,0);assert.equal(model.getState().tripped,false);assert.equal(model.getState().angle,0);
model.update({supply:1});model.advance(.6);assert(model.getState().tripped);assert(model.getState().angle>0);assert.equal(model.getState().current,0);
model.advance(1);assert(model.playback.complete());close(model.getState().pull,0,'Core returned');
const completedTime=model.getState().elapsed;model.advance(10);close(model.getState().elapsed,completedTime,'Completed trip stays stopped');
model.update({resistance:24});assert.equal(model.getState().current,0);model.actions[0].run();assert(model.getState().current>0);model.advance(2);assert.equal(model.getState().tripped,false);
reset();model.root.updateMatrixWorld(true);
const movingTip=part('contact').localToWorld(new THREE.Vector3(.7,0,0));
const fixedTip=part('fixed-contact').localToWorld(new THREE.Vector3());
close(movingTip.distanceTo(fixedTip),.105,'Closed contact spheres touch at their surfaces');
model.update({resistance:6});model.advance(2);model.root.updateMatrixWorld(true);
assert(part('contact').localToWorld(new THREE.Vector3(.7,0,0)).distanceTo(fixedTip)>.105,'Open contact has a physical gap');
for(const [i,experiment] of lesson.tryIt.entries()){
 assert.equal(experiment.reset,true);assert.deepEqual(Object.keys(experiment.values).sort(),model.controls.map(c=>c.key).sort());
 reset(experiment.values,experiment.initialState);const seeded=i===2||i===3;
 assert.equal(model.getState().tripped,seeded);assert.equal(model.playback.blocked(),seeded);assert.equal(model.playback.complete(),false);
 if(seeded){
  assert.equal(model.getState().current,0);close(model.getState().angle,.85,'Preset starts open');model.playback.step();close(model.getState().elapsed,0,'Prepared open contact waits for reset');
  model.actions[0].run();assert.equal(model.playback.blocked(),false);assert(model.getState().current>0);
 }
 if(i===4){model.playback.step();model.playback.step();model.update({supply:0});model.playback.step();model.playback.step();assert.equal(model.getState().tripped,false);close(model.getState().pull,0,'Interrupted pull returns');}
 else{model.advance(2);assert.equal(model.getState().tripped,i===1||i===3);}
 observations.push({experiment:experiment.title,seeded,values:model.getState().values,tripped:model.getState().tripped,current:model.getState().current});
}
const timing=[];
for(const rate of [15,60,144]){reset({resistance:6});for(let i=0;i<rate*2;i++)model.advance(1/rate);assert(model.playback.complete());timing.push(model.getState().elapsed);}
assert(Math.max(...timing)-Math.min(...timing)<.02,'Prescribed trip timing differs by less than two integration substeps');
reset();for(const invalid of [NaN,Infinity,-1,0])model.advance(invalid);close(model.getState().elapsed,0,'Invalid time does not advance');
model.dispose();
await writeFile(out+'/model.json',JSON.stringify({result:'PASS',combinations,observations,timing},null,2)+'\n');
console.log(`Breaker model: ${combinations} resistance/supply settings, contact geometry, staged trip, interruption, persistent latch, reset/retrip, timing and five independent presets pass.`);

if(process.env.MODEL_ONLY!=='1'){
 const browser=await chromium.launch({headless:true}),errors=[],cases=[];
 const base=process.env.SITE_URL||'http://127.0.0.1:5193/';
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce',hasTouch:width===390});page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base+'#machine/circuit-breaker');await page.locator('[data-play]').waitFor();
   const reading=label=>page.locator('.daily-readings>div').filter({has:page.locator('dt').filter({hasText:new RegExp('^'+label+'$')})}).locator('dd');
   for(const [i,experiment] of lesson.tryIt.entries()){
    console.log(width,experiment.title);
    await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
    assert.equal(await reading('Time observed').textContent(),'0.00 s');
    for(const [key,value] of Object.entries(experiment.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));
    const seeded=i===2||i===3;
    assert.equal(await page.locator('[data-play]').isDisabled(),seeded);
    if(seeded){
     assert.equal(await reading('Circuit current').textContent(),'0.000 A');assert.equal(await reading('Contact opening').textContent(),'48.7°');
     assert.match(await reading('Your result').textContent(),/Reset the breaker/);assert.match(await page.locator('[data-play]').getAttribute('title'),/Reset the breaker/);
     await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/preset-${width}-${i}-prepared.png`,clip:await page.locator('.daily-canvas-wrap').boundingBox()});
     await page.getByRole('button',{name:'Reset the breaker',exact:true}).click();assert.equal(await page.locator('[data-play]').isEnabled(),true);
     assert.equal(await reading('Contact opening').textContent(),'0.0°');assert.equal(await reading('Circuit current').textContent(),i===2?'0.496 A':'1.935 A');
    }
    if(i===4){
     await page.locator('[data-step]').click();await page.locator('[data-step]').click();
     assert.equal(await reading('Core withdrawal').textContent(),'78% of release travel');assert.equal(await reading('Contact opening').textContent(),'0.0°');
     await page.selectOption('[data-control="supply"]','0');await page.locator('[data-step]').click();await page.locator('[data-step]').click();
     assert.equal(await reading('Core withdrawal').textContent(),'0% of release travel');assert.equal(await reading('Contact opening').textContent(),'0.0°');assert.equal(await reading('Your result').textContent(),'Supply off');
    }else{
     if(i===1){await page.locator('[data-step]').click();assert.match(await reading('Mechanism').textContent(),/Core withdraws/);assert.equal(await reading('Contact opening').textContent(),'0.0°');}
     for(let step=0;step<10;step++)await page.locator('[data-step]').click();
     assert.equal(await reading('Circuit current').textContent(),i===1||i===3?'0.000 A':'0.496 A');
     if(i===1||i===3){
      assert.equal(await reading('Mechanism').textContent(),'Open and latched off');assert.equal(await page.locator('[data-play]').isEnabled(),true);
      const restarted=await page.locator('[data-play]').evaluate(button=>{button.click();return {readings:document.querySelector('.daily-readings').textContent,playing:button.getAttribute('aria-pressed')};});
      assert.match(restarted.readings,/0.00 s/);assert.match(restarted.readings,/1.935 A/);assert.equal(restarted.playing,'true');assert.equal(await page.locator('[data-control="resistance"]').inputValue(),'6');
      await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Open and latched off'));
      assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');
     }
    }
    await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/preset-${width}-${i}-result.png`,clip:await page.locator('.daily-canvas-wrap').boundingBox()});
    cases.push({width,experiment:experiment.title,seeded,result:await reading('Your result').textContent()});
   }
   await page.locator('[data-reset-controls]').click();assert.equal(await page.locator('[data-control="resistance"]').inputValue(),'24');assert.equal(await page.locator('[data-control="supply"]').inputValue(),'1');assert.equal(await reading('Time observed').textContent(),'0.00 s');
   await page.locator('[data-number="resistance"]').fill('48');await page.locator('[data-number="resistance"]').press('Enter');assert.equal(await reading('Circuit current').textContent(),'0.249 A');
   await page.locator('[data-play]').click();await page.waitForTimeout(250);await page.getByRole('button',{name:'Pause',exact:true}).click();
   const paused=await reading('Time observed').textContent();await page.waitForTimeout(200);assert.equal(await reading('Time observed').textContent(),paused);
   await page.locator('[data-number="resistance"]').fill('6');await page.locator('[data-number="resistance"]').press('Enter');await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Open and latched off'));
   await page.getByRole('button',{name:'Inspect the open contact',exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Moving contact arm');
   await page.locator('[data-view="reset"]').click();await page.locator('[data-separation]').fill('100');
   await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/separated-${width}.png`,clip:await page.locator('.daily-canvas-wrap').boundingBox()});
   for(const direction of ['in','out']){await page.locator(`[data-view="${direction}"]`).click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');}
   await page.locator('[data-reassemble]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'0');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:`${out}/result-page-${width}.png`,fullPage:true});
   // Shared play guard: an existing physical block disables play; completion replay still takes priority.
   await page.goto(base+'#machine/sewing-machine');await page.locator('[data-control="foot"]').waitFor();
   await page.selectOption('[data-control="foot"]','0');assert.equal(await page.locator('[data-play]').isDisabled(),true);assert.match(await page.locator('.daily-readings').textContent(),/Lower the presser foot/);
   await page.selectOption('[data-control="foot"]','1');assert.equal(await page.locator('[data-play]').isEnabled(),true);
   await page.locator('[data-number="length"]').fill('5');await page.locator('[data-number="length"]').press('Enter');
   for(let stitch=0;stitch<8;stitch++)await page.locator('[data-step]').click();
   assert.match(await page.locator('.daily-readings').textContent(),/Template complete/);
   await page.selectOption('[data-control="foot"]','0');assert.equal(await page.locator('[data-play]').isEnabled(),true);
   await page.locator('[data-play]').click();assert.equal(await page.locator('[data-play]').isDisabled(),true);
   await page.selectOption('[data-control="foot"]','1');assert.equal(await page.locator('[data-play]').isEnabled(),true);
   await page.locator('[data-step]').click();assert.match(await page.locator('.daily-readings').textContent(),/1 lockstitch ·/);
   await page.close();
  }
  assert.deepEqual(errors,[]);console.log('Breaker browser: ten preset/viewport cases, blocked-state hints, reset/retrip, staged interruption, replay, pause, controls, separation and shared sewing guard pass.');
 }catch(error){
  console.error(error);
  await writeFile(out+'/failure.json',JSON.stringify({error:String(error),pages:browser.contexts().flatMap(context=>context.pages()).map(page=>({url:page.url(),closed:page.isClosed()}))},null,2));
  for(const [i,page] of browser.contexts().flatMap(context=>context.pages()).entries()){await writeFile(`${out}/failure-${i}.json`,JSON.stringify({url:page.url(),body:await page.locator('body').innerText({timeout:3000}).catch(e=>String(e)),error:String(error)},null,2));await page.screenshot({path:`${out}/failure-${i}.png`,fullPage:true,timeout:3000}).catch(()=>{});}
  throw error;
 }finally{await writeFile(out+'/browser.json',JSON.stringify({base,cases,errors},null,2)+'\n');await browser.close();}
}

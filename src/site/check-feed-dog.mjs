import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createSewingModel} from './sewing-model.js';
import {utilityComponentLessons} from './utility-lessons.js';
const lesson=utilityComponentLessons['Feed-dog'],model=createSewingModel({feedLesson:true});
const out=process.env.EVIDENCE_DIR||'/tmp/howthingswork-feed-dog';await mkdir(out,{recursive:true});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`),object=id=>model.parts.find(p=>p.id===id).object,read=label=>model.getState().readings.find(r=>r.label===label).value;
for(const preset of lesson.tryIt){assert.equal(preset.reset,true);assert.equal(preset.part,'feed-bar');assert.equal(preset.view,'side');assert.equal(preset.isolate,true);assert.equal(preset.cutaway,true);assert.deepEqual(Object.keys(preset.values).sort(),Object.keys(model.defaults).sort());}
let poses=0;const heights=[];
for(const length of [1,3,5]){
 model.reset();model.update({length});near(object('feed-bar').position.z,length*.025*.5);near(object('feed-output').position.y,.42+.20*(length*.025/.10));let previousProgress=0;
 for(let i=0;i<1000;i++){
  if(i)model.advance(.001);model.root.updateMatrixWorld(true);const state=model.getState(),teeth=new THREE.Box3().setFromObject(object('feed-bar')),plate=new THREE.Box3().setFromObject(object('needle-plate')),height=teeth.max.y-plate.max.y;
  assert.equal(state.readings.length,12);assert.ok(state.readings.every(r=>r.hint));assert.ok(Math.abs(parseFloat(read('Tooth height vs plate'))-height)<.000501,'rounded height matches actual tooth and plate surfaces');
  if(state.feeding)assert.ok(state.needleTip>1.04);assert.ok(state.feedDistance>=previousProgress-1e-8,'fabric never travels backward during feed return');previousProgress=state.feedDistance;
  if(state.phase>.20)assert.ok(height<0,'return stays below the plate');if(i===20)heights.push(height);poses++;
 }
 near(model.getState().feedDistance,length);
}
heights.forEach(h=>near(h,heights[0]));
for(const phase of [.02,.08,.14,.5,.94]){model.reset();model.advance(phase);const before={position:object('cloth').position.toArray(),progress:model.getState().feedDistance,phase:model.getState().phase};model.update({foot:0});model.advance(2);assert.deepEqual({position:object('cloth').position.toArray(),progress:model.getState().feedDistance,phase:model.getState().phase},before);assert.equal(read('Feed phase'),'Paused: foot up');model.update({foot:1});assert.deepEqual(object('cloth').position.toArray(),before.position);}
const outcomes=[];
for(const [index,preset] of lesson.tryIt.entries()){
 model.reset();model.update(preset.values);
 if(index===0){model.actions[0].run();near(model.getState().feedDistance,3);assert.equal(read('Tooth height vs plate'),'0.020 model units');model.actions[0].run();near(model.getState().feedDistance,3);assert.equal(read('Tooth height vs plate'),'-0.030 model units');}
 if(index===3){model.playback.step();near(model.getState().distance,0);model.update({foot:1});}
 if(index===4){model.actions[0].run();model.update({length:5});model.playback.step();near(model.getState().distance,3);model.playback.step();near(model.getState().distance,8);}
 model.advance(120);const state=model.getState();assert.equal(state.stitches.length,[14,40,8,14,9][index]);near(state.sewn,40);assert.equal(read('Feed phase'),'Run finished');outcomes.push({index,stitches:state.stitches.length,sewn:state.sewn});
}
model.dispose();await writeFile(out+'/model.json',JSON.stringify({poses,heights,outcomes},null,2)+'\n');console.log('PASS Feed-dog: 3,000 actual tooth/plate poses, unchanged lift across lengths, pause without reverse travel and five exact outcomes.');
if(process.env.MODEL_ONLY!=='1'){
 const {chromium}=await import('playwright'),browser=await chromium.launch({headless:true});const base=process.env.SITE_URL||'http://127.0.0.1:5193/',cases=[],errors=[];
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'#machine/feed-dog');await page.locator('[data-play]').waitFor();
   const reading=label=>page.locator('.daily-readings>div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd');
   const values=async()=>Object.fromEntries(await page.locator('[data-control]').evaluateAll(es=>es.map(e=>[e.dataset.control,Number(e.value)])));
   const capture=async name=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({path:`${out}/${name}-${width}.png`,clip:await page.locator('canvas').boundingBox()});};
   const setup=async index=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${index}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();};
   assert.equal(await page.locator('.daily-part-path [data-parent]').last().getAttribute('data-parent'),'feed-bar');assert.equal(await page.locator('[data-isolate]').isChecked(),true);await capture('opening');await page.locator('[data-view="top"]').click();await capture('two-rows');
   for(const [index,preset] of lesson.tryIt.entries()){
    await page.locator('[data-control="template"]').selectOption('1');await page.locator('[data-control="foot"]').selectOption('0');await page.locator('[data-control="threaded"]').selectOption('0');await page.locator('[data-number="length"]').fill('4');await page.locator('[data-number="length"]').press('Enter');await page.locator('[data-number="rate"]').fill('3');await page.locator('[data-number="rate"]').press('Enter');await page.locator('[data-isolate]').uncheck();await page.locator('[data-cutaway]').uncheck();await page.locator('[data-view="top"]').click();
    await setup(index);assert.deepEqual(await values(),preset.values);assert.equal(await page.locator('[data-isolate]').isChecked(),true);assert.equal(await page.locator('[data-cutaway]').isChecked(),true);assert.equal(await reading('Fabric progress').textContent(),'0.0 / 40 mm advanced');assert.equal(await page.locator('.daily-readings>div').count(),12);assert.equal(await page.locator('.daily-readings>div').filter({has:page.locator('p')}).count(),12);const start=await capture('setup-'+index);await page.locator('[data-view="side"]').click();assert.equal(Buffer.compare(start,await capture('view-check-'+index)),0,'preset restores tooth-row Side view');
    if(index===0){await page.getByRole('button',{name:'Next stitch stage',exact:true}).click();assert.equal(await reading('Fabric progress').textContent(),'3.0 / 40 mm advanced');assert.equal(await reading('Tooth height vs plate').textContent(),'0.020 model units');await capture('raised-forward');await page.locator('[data-control="foot"]').selectOption('0');assert.equal(await reading('Fabric progress').textContent(),'3.0 / 40 mm advanced');assert.equal(await page.locator('[data-play]').isDisabled(),true);await page.locator('[data-step]').click();assert.equal(await reading('Cycle position').textContent(),'14.0%');await capture('paused-foot');await page.locator('[data-control="foot"]').selectOption('1');await page.getByRole('button',{name:'Next stitch stage',exact:true}).click();assert.equal(await reading('Fabric progress').textContent(),'3.0 / 40 mm advanced');assert.equal(await reading('Tooth height vs plate').textContent(),'-0.030 model units');await capture('lowered-return');}
    if(index===3){assert.equal(await page.locator('[data-play]').isDisabled(),true);await page.locator('[data-step]').click();assert.equal(await reading('Fabric progress').textContent(),'0.0 / 40 mm advanced');await page.locator('[data-control="foot"]').selectOption('1');}
    if(index===4){await page.getByRole('button',{name:'Next stitch stage',exact:true}).click();await page.locator('[data-number="length"]').fill('5');await page.locator('[data-number="length"]').press('Enter');await page.locator('[data-step]').click();assert.equal(await reading('Your result').textContent(),'1 lockstitch · 3.0 / 40 mm sewn');await page.locator('[data-step]').click();assert.equal(await reading('Your result').textContent(),'2 lockstitches · 8.0 / 40 mm sewn');await capture('changed-length');}
    else{await page.locator('[data-step]').click();assert.equal(await reading('Your result').textContent(),`1 lockstitch · ${preset.values.length.toFixed(1)} / 40 mm sewn`);}
    if(index===2){await page.locator('[data-play]').click();await page.waitForTimeout(250);await page.locator('[data-play]').click();const stopped=await reading('Cycle position').textContent();await page.waitForTimeout(180);assert.equal(await reading('Cycle position').textContent(),stopped);await page.locator('[data-play]').click();await page.waitForTimeout(150);await page.locator('[data-play]').click();}
    for(let i=0;i<41;i++){if((await page.locator('[data-play]').getAttribute('title')).startsWith('Play again'))break;await page.locator('[data-step]').click();}
    const count=[14,40,8,14,9][index];assert.equal(await reading('Your result').textContent(),`${count} lockstitches · 40.0 / 40 mm sewn`);assert.equal(await reading('Feed phase').textContent(),'Run finished');assert.equal(await page.locator('.daily-part-path [data-parent]').last().getAttribute('data-parent'),'feed-bar');await capture('complete-'+index);await page.locator('[data-result]').click();await page.locator('[data-view="top"]').click();await capture('top-'+index);await page.locator('[data-view="bottom"]').click();await capture('bottom-'+index);await page.locator('[data-play]').evaluate(b=>{b.click();b.click()});assert.equal(await reading('Fabric progress').textContent(),'0.0 / 40 mm advanced');assert.equal(await page.locator('.daily-part-path [data-parent]').last().getAttribute('data-parent'),'feed-bar');assert.equal(await page.locator('[data-isolate]').isChecked(),true);assert.deepEqual(await values(),{...preset.values,foot:1,length:index===4?5:preset.values.length});await capture('replay-'+index);cases.push({width,index,count,replay:true});
   }
   await page.locator('[data-reset-controls]').click();await page.locator('[data-separation]').fill('100');await page.getByText('Fully separated',{exact:true}).waitFor();await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await capture('separated');await page.locator('[data-reassemble]').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.close();
  }
  assert.equal(cases.length,10);assert.deepEqual(errors,[]);await writeFile(out+'/browser.json',JSON.stringify({base,cases,errors},null,2)+'\n');console.log('PASS Feed-dog: ten desktop/phone cases, visible feed phases, foot pause/resume, spacing change, completed seam, replay and separation.');
 }finally{await browser.close();}
}

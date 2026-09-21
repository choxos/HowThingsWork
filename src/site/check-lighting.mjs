import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createLightingModel} from './lighting-model.js';
import {safetyLessons} from './safety-lessons.js';
import {chromium} from 'playwright';

const lesson=safetyLessons['Two-way light switch'];
const out=process.env.EVIDENCE_DIR||'documentation/audit/evidence/two-way-light-switch-20260919';
await mkdir(out,{recursive:true});
const model=createLightingModel(),observations=[];
const reset=values=>{model.reset();model.update({...model.defaults,...values});};
const close=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-9,message+`: ${actual} != ${expected}`);
const pagePart=model.parts.find(part=>part.id==='illuminated-page').object;
const paper=pagePart.children.find(child=>child.material?.isMeshStandardMaterial);
const dots=model.parts.find(part=>part.id==='electrons').object.children;
assert(dots.every(dot=>dot.geometry.parameters.radius>.025),'Flow markers must protrude beyond the wire surface to be visible');
assert.deepEqual(model.controls.map(control=>control.key),['first','second','voltage','resistance']);
assert(!model.parts.some(part=>['protection','meter'].includes(part.id)));
let combinations=0;
for(const first of [0,1])for(const second of [0,1])for(let voltage=0;voltage<=24;voltage+=.5)for(let resistance=0;resistance<=60;resistance+=2){
 model.update({first,second,voltage,resistance});const state=model.getState();
 const current=first===second?voltage/(12+resistance):0;
 close(state.current,current,'Current');close(state.power,current*current*12,'Lamp power');
 close(state.totalPower,state.power+state.resistorPower,'Power balance');
 assert.equal(state.complete,first===second);
 assert.equal(model.root.getObjectByProperty('isPointLight',true).intensity>0,current>0);
 assert(dots.every(dot=>dot.visible===(current>0)));
 combinations++;
}
for(const selection of [0,1]){
 model.update({first:selection,second:selection});model.root.updateMatrixWorld(true);
 for(const [suffix,side] of [['a',-1],['b',1]]){
  const contact=model.parts.find(part=>part.id==='contact-'+suffix).object;
  const sw=model.parts.find(part=>part.id==='switch-'+suffix).object;
  const tip=contact.localToWorld(new THREE.Vector3(-side*Math.hypot(.28,.15),0,0));
  const terminal=sw.localToWorld(new THREE.Vector3(-side*.28,selection?-.15:.15,.06));
  close(tip.distanceTo(terminal),0,'Contact reaches the selected traveler terminal');
 }
}
reset({resistance:36});const dim=paper.material.color.r;model.update({resistance:0});assert(paper.material.color.r>dim);
reset({});const before=dots.map(dot=>dot.position.clone());model.playback.step();close(model.getState().charge,.5,'Step transfers charge');
assert(dots.some(dot=>before.every(point=>dot.position.distanceTo(point)>.005)),'A half-second step visibly shifts the set of markers, not only their identities');
reset({});model.advance(2);model.update({resistance:36});model.advance(2);model.update({second:1});model.advance(2);
close(model.getState().charge,2.5,'Charge integrates the actual current history');assert(model.playback.complete());
model.advance(100);close(model.getState().elapsed,6,'Observation stops exactly at six seconds');close(model.getState().charge,2.5,'Completed observation does not add charge');
for(const rate of [15,60,144]){reset({resistance:36});for(let i=0;i<rate*6;i++)model.advance(1/rate);close(model.getState().charge,1.5,'Frame-rate parity');assert(model.playback.complete());}
reset({});for(const invalid of [NaN,Infinity,-1,0])model.advance(invalid);close(model.getState().elapsed,0,'Invalid time does not advance');
const expectedCurrents=[0,1,1,.25,.5,0],expectedPowers=[0,12,12,.75,3,0];
for(const [i,experiment] of lesson.tryIt.entries()){
 assert.equal(experiment.reset,true);assert.deepEqual(Object.keys(experiment.values).sort(),model.controls.map(control=>control.key).sort());
 reset(experiment.values);close(model.getState().current,expectedCurrents[i],experiment.title);close(model.getState().power,expectedPowers[i],experiment.title);
 model.advance(6);close(model.getState().charge,expectedCurrents[i]*6,experiment.title);assert(model.playback.complete());
 observations.push({experiment:experiment.title,current:model.getState().current,power:model.getState().power,charge:model.getState().charge});
}
reset(lesson.tryIt[0].values);model.update({second:1});close(model.getState().current,1,'Other switch restores the light');
assert(model.getState().readings.every(reading=>reading.hint));model.dispose();
await writeFile(out+'/model.json',JSON.stringify({combinations,observations,result:'PASS'},null,2)+'\n');
console.log(`Lighting model: ${combinations} switch/voltage/resistance combinations, contact geometry, charge integration, frame-rate parity and six independent presets pass.`);

if(process.env.MODEL_ONLY!=='1'){
 const browser=await chromium.launch({headless:true}),errors=[],cases=[];
 const base=process.env.SITE_URL||'http://127.0.0.1:5193/';
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base+'#machine/two-way-light-switch');await page.locator('[data-step]').waitFor();
   const reading=label=>page.locator('.daily-readings > div').filter({has:page.locator('dt').filter({hasText:new RegExp('^'+label+'$')})}).locator('dd');
   assert.equal(await page.locator('[data-control]').count(),4);
   assert.equal(await page.locator('[data-speed]').isVisible(),false);
   for(const first of [0,1])for(const second of [0,1]){
    await page.locator('[data-control="first"]').selectOption(String(first));
    await page.locator('[data-control="second"]').selectOption(String(second));
    assert.match(await reading('Your result').textContent(),first===second?/Page illuminated/:/route interrupted/);
   }
   for(const [i,experiment] of lesson.tryIt.entries()){
    await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();
    await page.locator('[data-experiment]').nth(i).click();
    await page.getByRole('tab',{name:'Controls',exact:true}).click();
    for(const [key,value] of Object.entries(experiment.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));
    assert.equal(await reading('Time observed').textContent(),'0.00 s');
    assert.equal(await reading('Charge through lamp').textContent(),'0.00 C');
    assert.equal(await reading('Circuit current').textContent(),expectedCurrents[i].toFixed(3)+' A');
    for(let step=0;step<12;step++)await page.locator('[data-step]').click();
    assert.equal(await reading('Time observed').textContent(),'6.00 s');
    assert.equal(await reading('Charge through lamp').textContent(),(expectedCurrents[i]*6).toFixed(2)+' C');
    await page.locator('canvas').scrollIntoViewIfNeeded();
    await page.screenshot({path:`${out}/preset-${i}-${width}.png`,clip:await page.locator('.daily-canvas-wrap').boundingBox()});
    cases.push({width,experiment:experiment.title,current:expectedCurrents[i],charge:expectedCurrents[i]*6});
   }
   await page.locator('[data-play]').click();
   await page.waitForFunction(()=>[...document.querySelectorAll('.daily-readings>div')].some(n=>n.querySelector('dt')?.textContent==='Time observed'&&parseFloat(n.querySelector('dd').textContent)>0));
   await page.getByRole('button',{name:'Pause',exact:true}).click();
   const paused=await reading('Time observed').textContent();await page.waitForTimeout(250);assert.equal(await reading('Time observed').textContent(),paused);
   assert.equal(await page.locator('[data-control="voltage"]').inputValue(),'0','Replay keeps the unpowered preset');
   await page.locator('[data-reset-controls]').click();assert.equal(await reading('Time observed').textContent(),'0.00 s');
   await page.locator('[data-number="voltage"]').fill('24');await page.locator('[data-number="voltage"]').press('Enter');
   await page.locator('[data-number="resistance"]').fill('36');await page.locator('[data-number="resistance"]').press('Enter');
   assert.equal(await reading('Circuit current').textContent(),'0.500 A');
   await page.locator('[data-play]').click();
   await page.waitForFunction(()=>[...document.querySelectorAll('.daily-readings>div')].some(n=>n.querySelector('dt')?.textContent==='Time observed'&&n.querySelector('dd').textContent==='6.00 s'),null,{timeout:12000});
   assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');
   assert.equal(await reading('Charge through lamp').textContent(),'3.00 C');
   await page.locator('[data-play]').click();await page.waitForTimeout(150);await page.getByRole('button',{name:'Pause',exact:true}).click();
   assert(parseFloat(await reading('Time observed').textContent())<1);assert.equal(await page.locator('[data-control="voltage"]').inputValue(),'24');
   await page.locator('[data-separation]').fill('100');await page.waitForFunction(()=>document.querySelector('.daily-canvas-wrap').dataset.explosion==='1');
   await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/separated-${width}.png`,clip:await page.locator('.daily-canvas-wrap').boundingBox()});
   for(const direction of ['in','out']){await page.locator(`[data-view="${direction}"]`).click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');}
   await page.locator('[data-reassemble]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'0');
   await page.getByRole('button',{name:'Inspect the reading light',exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Illuminated reading page');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:`${out}/result-page-${width}.png`,fullPage:true});await page.close();
  }
  assert.deepEqual(errors,[]);console.log('Lighting browser: twelve preset/viewport cases, all controls, step, pause, reset, completion replay, separation and result inspection pass.');
 }finally{await writeFile(out+'/browser.json',JSON.stringify({base,cases,errors},null,2)+'\n');await browser.close();}
}

import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createSewingModel} from './sewing-model.js';
import {utilityComponentLessons} from './utility-lessons.js';

const model=createSewingModel({needleLesson:true}),lesson=utilityComponentLessons['Needle and needle thread'];
const out=process.env.EVIDENCE_DIR||'/tmp/howthingswork-needle';await mkdir(out,{recursive:true});
const object=id=>model.parts.find(p=>p.id===id).object,near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`),read=label=>model.getState().readings.find(r=>r.label===label).value;
const needle=object('needle'),eye=needle.children.find(p=>p.geometry?.type==='TorusGeometry'),loop=object('hook-assembly').children.find(p=>p.isInstancedMesh),pose=new THREE.Matrix4();
let poses=0;const strokes=[];
for(const length of [1,3,5]){
 model.reset();model.update({length});const heights=[];
 for(let i=0;i<1000;i++){
  if(i)model.advance(.001);model.root.updateMatrixWorld(true);const state=model.getState(),actualEye=eye.getWorldPosition(new THREE.Vector3()),tip=needle.localToWorld(new THREE.Vector3(-.85,-.35,.15));heights.push(actualEye.y);
  near(tip.y,state.needleTip);near(actualEye.y-tip.y,.05);assert.ok(Math.abs(parseFloat(read('Needle eye height'))-(actualEye.y-1.04))<.000501);assert.ok(Math.abs(parseFloat(read('Needle tip clearance'))-(tip.y-1.056))<.000501);
  loop.getMatrixAt(0,pose);const start=loop.localToWorld(new THREE.Vector3(0,-.5,0).applyMatrix4(pose));assert.ok(start.distanceTo(actualEye)<1e-6,'upper loop remains attached to actual needle eye');
  near(object('connecting-rod').children[0].scale.y,.70);if(state.feeding)assert.ok(tip.y>1.056);assert.equal(state.readings.length,12);assert.ok(state.readings.every(r=>r.hint));poses++;
 }
 const stroke=Math.max(...heights)-Math.min(...heights);near(stroke,.64);strokes.push({length,low:Math.min(...heights),high:Math.max(...heights),stroke});
}
model.reset({phase:.5});model.root.updateMatrixWorld(true);const lowest=eye.getWorldPosition(new THREE.Vector3()).y;model.advance(.05);model.root.updateMatrixWorld(true);const catchHeight=eye.getWorldPosition(new THREE.Vector3()).y;assert.ok(catchHeight>lowest&&catchHeight<1.04);assert.equal(read('Needle eye height'),'-0.287 model units');
const outcomes=[];
for(const [index,preset] of lesson.tryIt.entries()){
 assert.equal(preset.reset,true);assert.equal(preset.part,'stitch-formation');assert.equal(preset.view,'iso');assert.equal(preset.isolate,true);assert.equal(preset.cutaway,true);assert.deepEqual(Object.keys(preset.values).sort(),Object.keys(model.defaults).sort());model.reset();model.update(preset.values);
 if(index===4){model.playback.step();near(model.getState().sewn,0);near(model.getState().distance,3);model.update({threaded:1});model.playback.step();assert.deepEqual(model.getState().stitches,[{from:3,to:6}]);}
 model.advance(120);const state=model.getState();near(state.sewn,index===4?37:40);assert.equal(state.stitches.length,[14,14,40,8,13][index]);assert.equal(state.complete,true);outcomes.push({index,count:state.stitches.length,sewn:state.sewn});
}
model.dispose();await writeFile(out+'/model.json',JSON.stringify({poses,strokes,lowest,catchHeight,outcomes},null,2)+'\n');console.log('PASS Needle: 3,000 actual eye/tip poses, connected upper thread, 0.640 stroke at three feed lengths and five exact outcomes.');
if(process.env.MODEL_ONLY!=='1'){
 const {chromium}=await import('playwright'),browser=await chromium.launch({headless:true}),base=process.env.SITE_URL||'http://127.0.0.1:5193/',cases=[],errors=[];
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'#machine/needle-and-needle-thread');await page.locator('[data-play]').waitFor();
   const reading=label=>page.locator('.daily-readings>div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd');
   const values=async()=>Object.fromEntries(await page.locator('[data-control]').evaluateAll(inputs=>inputs.map(input=>[input.dataset.control,Number(input.value)])));
   const capture=async name=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({path:`${out}/${name}-${width}.png`,clip:await page.locator('canvas').boundingBox()});};
   const renderedPixels=()=>page.evaluate(async()=>{document.querySelector('[data-control="length"]').dispatchEvent(new Event('input',{bubbles:true}));const source=document.querySelector('canvas'),copy=new OffscreenCanvas(source.width,source.height),context=copy.getContext('2d');context.drawImage(source,0,0);const pixels=context.getImageData(0,0,copy.width,copy.height).data;if(!pixels.some((value,i)=>i%4===0&&value<100&&pixels[i+1]<100&&pixels[i+2]<100))throw new Error('rendered canvas must contain dark case or hook geometry');return {width:copy.width,height:copy.height,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))).map(v=>v.toString(16).padStart(2,'0')).join('')};});
   const selected=()=>page.locator('.daily-part-path [data-parent]').last().getAttribute('data-parent');
   assert.equal(await selected(),'stitch-formation');assert.equal(await page.locator('[data-isolate]').isChecked(),true);await capture('opening');
   for(const [index,preset] of lesson.tryIt.entries()){
    await page.locator('[data-control="template"]').selectOption('1');await page.locator('[data-control="foot"]').selectOption('0');await page.locator('[data-control="threaded"]').selectOption('0');await page.locator('[data-number="length"]').fill('4');await page.locator('[data-number="length"]').press('Enter');await page.locator('[data-number="rate"]').fill('3');await page.locator('[data-number="rate"]').press('Enter');await page.locator('[data-isolate]').uncheck();await page.locator('[data-cutaway]').uncheck();await page.locator('[data-view="top"]').click();
    await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${index}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();assert.deepEqual(await values(),preset.values);assert.equal(await selected(),preset.part);assert.equal(await page.locator('[data-cutaway]').isChecked(),preset.cutaway);assert.equal(await page.locator('[data-isolate]').isChecked(),true);assert.equal(await reading('Fabric progress').textContent(),'0.0 / 40 mm advanced');assert.equal(await page.locator('.daily-readings>div').filter({has:page.locator('p')}).count(),12);
    await capture('setup-'+index);const start=await renderedPixels();await page.locator('[data-view="iso"]').click();await capture('view-check-'+index);assert.deepEqual(await renderedPixels(),start,'preset restores exact rendered isometric view');
    assert.equal(await reading('Needle eye height').textContent(),'0.330 model units');
    for(let i=0;i<2;i++)await page.getByRole('button',{name:'Next stitch stage',exact:true}).click();assert.equal(await reading('Cycle position').textContent(),'50.0%');assert.equal(await reading('Needle eye height').textContent(),'-0.310 model units');assert.equal(await reading('Needle tip clearance').textContent(),'-0.376 model units');await capture('lowest-'+index);
    if(index===0){await page.locator('[data-control="foot"]').selectOption('0');await page.locator('[data-step]').click();assert.equal(await reading('Cycle position').textContent(),'50.0%');assert.equal(await reading('Needle eye height').textContent(),'-0.310 model units');await page.locator('[data-control="foot"]').selectOption('1');}
    if(index===1||index===4){await page.getByRole('button',{name:'Next stitch stage',exact:true}).click();assert.equal(await reading('Cycle position').textContent(),'55.0%');assert.equal(await reading('Needle eye height').textContent(),'-0.287 model units');await capture('early-rise-'+index);}
    await page.locator('[data-step]').click();
    if(index===4){assert.equal(await reading('Your result').textContent(),'0 lockstitches · 0.0 / 40 mm sewn');assert.equal(await reading('Fabric progress').textContent(),'3.0 / 40 mm advanced');await capture('missing');await page.locator('[data-control="threaded"]').selectOption('1');await page.locator('[data-step]').click();assert.equal(await reading('Your result').textContent(),'1 lockstitch · 3.0 / 40 mm sewn');assert.equal(await reading('Fabric progress').textContent(),'6.0 / 40 mm advanced');await capture('restored');}
    else assert.equal(await reading('Your result').textContent(),`1 lockstitch · ${preset.values.length.toFixed(1)} / 40 mm sewn`);
    if(index===3){await page.locator('[data-play]').click();await page.waitForTimeout(250);await page.locator('[data-play]').click();const paused=await reading('Cycle position').textContent();await page.waitForTimeout(180);assert.equal(await reading('Cycle position').textContent(),paused);await page.locator('[data-play]').click();await page.waitForTimeout(150);await page.locator('[data-play]').click();}
    for(let i=0;i<41;i++){if((await page.locator('[data-play]').getAttribute('title')).startsWith('Play again'))break;await page.locator('[data-step]').click();}
    const count=[14,14,40,8,13][index],sewn=index===4?37:40;assert.equal(await reading('Your result').textContent(),`${count} lockstitches · ${sewn.toFixed(1)} / 40 mm sewn`);assert.equal(await selected(),preset.part);await capture('complete-'+index);await page.locator('[data-result]').click();await page.locator('[data-view="top"]').click();await capture('top-'+index);await page.locator('[data-view="bottom"]').click();await capture('bottom-'+index);
    await page.locator('[data-play]').evaluate(b=>{b.click();b.click()});assert.equal(await reading('Fabric progress').textContent(),'0.0 / 40 mm advanced');assert.equal(await selected(),preset.part);assert.deepEqual(await values(),{...preset.values,threaded:1});await capture('replay-'+index);cases.push({width,index,count,sewn,replay:true});
   }
   await page.locator('[data-reset-controls]').click();await page.locator('[data-separation]').fill('100');await page.getByText('Fully separated',{exact:true}).waitFor();await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await capture('separated');await page.locator('[data-reassemble]').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.close();
  }
  assert.equal(cases.length,10);assert.deepEqual(errors,[]);await writeFile(out+'/browser.json',JSON.stringify({base,cases,errors},null,2)+'\n');console.log('PASS Needle: ten desktop/phone cases, actual eye/tip heights, early-rise catch, unchanged stroke, missing-thread recovery, replay and separation.');
 }finally{await browser.close();}
}

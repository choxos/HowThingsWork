import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createSewingModel} from './sewing-model.js';
import {utilityComponentLessons} from './utility-lessons.js';

const model=createSewingModel(),lesson=utilityComponentLessons['Bobbin and bobbin thread'];
const out=process.env.EVIDENCE_DIR||'/tmp/howthingswork-bobbin';await mkdir(out,{recursive:true});
const object=id=>model.parts.find(p=>p.id===id).object,near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const bobbin=object('bobbin'),caseObject=object('bobbin-case'),retainer=object('bobbin-retainer'),lower=object('bobbin-thread').children.find(p=>p.isInstancedMesh),pose=new THREE.Matrix4();
assert.notEqual(bobbin,caseObject);assert.equal(bobbin.parent,caseObject.parent);assert.equal(retainer.parent,caseObject.parent);
assert.equal(caseObject.children.filter(p=>model.covers.includes(p)).length,2,'cutaway removes the shell and rear plate, retaining the rim and exit');
model.root.updateMatrixWorld(true);const fixed=[caseObject,retainer].map(p=>p.matrixWorld.toArray());
for(let i=0;i<200;i++){
 model.advance(.005);model.root.updateMatrixWorld(true);assert.deepEqual([caseObject,retainer].map(p=>p.matrixWorld.toArray()),fixed,'case and retaining finger stay fixed while hook rotates');
 near(object('hook').rotation.x,model.getState().phase*4*Math.PI-2*.55*2*Math.PI);assert.equal(lower.count,3);
 let end;for(let j=0;j<lower.count;j++){lower.getMatrixAt(j,pose);const start=new THREE.Vector3(0,-.5,0).applyMatrix4(pose),next=new THREE.Vector3(0,.5,0).applyMatrix4(pose);if(end)assert.ok(start.distanceTo(end)<1e-7,'lower-thread segments remain connected');end=next;}
 const world=lower.localToWorld(end);near(world.x,-.85);near(world.y,1.04);near(world.z,.15);
 assert.equal(model.getState().readings.length,10);assert.ok(model.getState().readings.every(r=>r.hint));
}
const outcomes=[];
for(const [index,preset] of lesson.tryIt.entries()){
 assert.equal(preset.reset,true);assert.equal(preset.part,'hook-assembly');assert.equal(preset.view,'iso');assert.equal(preset.isolate,true);assert.equal(preset.cutaway,index!==4);assert.deepEqual(Object.keys(preset.values).sort(),Object.keys(model.defaults).sort());
 model.reset();model.update(preset.values);assert.equal(lower.count,index===1?0:3);
 if(index===1){model.playback.step();near(model.getState().sewn,0);near(model.getState().distance,3);model.update({threaded:1});model.playback.step();assert.deepEqual(model.getState().stitches,[{from:3,to:6}]);}
 model.advance(120);const state=model.getState();near(state.sewn,index===1?37:40);assert.equal(state.stitches.length,[14,13,40,8,14][index]);assert.equal(state.complete,true);outcomes.push({index,count:state.stitches.length,sewn:state.sewn});
}
model.dispose();await writeFile(out+'/model.json',JSON.stringify({stationaryPoses:200,connectedPathSegments:3,outcomes},null,2)+'\n');console.log('PASS Bobbin: separate case/spool, 200 fixed-case poses, continuous lower thread and five exact outcomes.');
if(process.env.MODEL_ONLY!=='1'){
 const {chromium}=await import('playwright'),browser=await chromium.launch({headless:true}),base=process.env.SITE_URL||'http://127.0.0.1:5193/',cases=[],errors=[];
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'#machine/bobbin-and-bobbin-thread');await page.locator('[data-play]').waitFor();
   const reading=label=>page.locator('.daily-readings>div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd');
   const values=async()=>Object.fromEntries(await page.locator('[data-control]').evaluateAll(inputs=>inputs.map(input=>[input.dataset.control,Number(input.value)])));
   const capture=async name=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({path:`${out}/${name}-${width}.png`,clip:await page.locator('canvas').boundingBox()});};
   const renderedPixels=()=>page.evaluate(async()=>{document.querySelector('[data-control="length"]').dispatchEvent(new Event('input',{bubbles:true}));const source=document.querySelector('canvas'),copy=new OffscreenCanvas(source.width,source.height),context=copy.getContext('2d');context.drawImage(source,0,0);const pixels=context.getImageData(0,0,copy.width,copy.height).data;if(!pixels.some((value,i)=>i%4===0&&value<100&&pixels[i+1]<100&&pixels[i+2]<100))throw new Error('rendered canvas must contain dark case or hook geometry');return {width:copy.width,height:copy.height,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))).map(v=>v.toString(16).padStart(2,'0')).join('')};});
   const selected=()=>page.locator('.daily-part-path [data-parent]').last().getAttribute('data-parent');
   assert.equal(await selected(),'hook-assembly');assert.equal(await page.locator('[data-isolate]').isChecked(),true);await capture('opening');
   for(const [index,preset] of lesson.tryIt.entries()){
    await page.locator('[data-control="template"]').selectOption('1');await page.locator('[data-control="foot"]').selectOption('0');await page.locator('[data-control="threaded"]').selectOption('0');await page.locator('[data-number="length"]').fill('4');await page.locator('[data-number="length"]').press('Enter');await page.locator('[data-number="rate"]').fill('3');await page.locator('[data-number="rate"]').press('Enter');await page.locator('[data-isolate]').uncheck();await page.locator('[data-cutaway]').uncheck();await page.locator('[data-view="top"]').click();
    await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${index}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();assert.deepEqual(await values(),preset.values);assert.equal(await selected(),preset.part);assert.equal(await page.locator('[data-cutaway]').isChecked(),preset.cutaway);assert.equal(await page.locator('[data-isolate]').isChecked(),true);assert.equal(await reading('Fabric progress').textContent(),'0.0 / 40 mm advanced');assert.equal(await page.locator('.daily-readings>div').filter({has:page.locator('p')}).count(),10);
    await capture('setup-'+index);const start=await renderedPixels();await page.locator('[data-view="iso"]').click();await capture('view-check-'+index);assert.deepEqual(await renderedPixels(),start,'preset restores exact rendered isometric view');
    if(index===0||index===4){for(const phase of ['14.0%','50.0%','55.0%','70.0%','84.0%']){await page.getByRole('button',{name:'Next stitch stage',exact:true}).click();assert.equal(await reading('Cycle position').textContent(),phase);if(['55.0%','70.0%','84.0%'].includes(phase))await capture('carry-'+index+'-'+phase.replace('.0%',''));}if(index===4){await page.locator('[data-cutaway]').check();await capture('case-open');}}
    await page.locator('[data-step]').click();
    if(index===1){assert.equal(await reading('Your result').textContent(),'0 lockstitches · 0.0 / 40 mm sewn');assert.equal(await reading('Fabric progress').textContent(),'3.0 / 40 mm advanced');await capture('missing');await page.locator('[data-control="threaded"]').selectOption('1');await page.locator('[data-step]').click();assert.equal(await reading('Your result').textContent(),'1 lockstitch · 3.0 / 40 mm sewn');assert.equal(await reading('Fabric progress').textContent(),'6.0 / 40 mm advanced');await capture('restored');}
    else assert.equal(await reading('Your result').textContent(),`1 lockstitch · ${preset.values.length.toFixed(1)} / 40 mm sewn`);
    if(index===3){await page.locator('[data-play]').click();await page.waitForTimeout(250);await page.locator('[data-play]').click();const paused=await reading('Cycle position').textContent();await page.waitForTimeout(180);assert.equal(await reading('Cycle position').textContent(),paused);await page.locator('[data-play]').click();await page.waitForTimeout(150);await page.locator('[data-play]').click();}
    for(let i=0;i<41;i++){if((await page.locator('[data-play]').getAttribute('title')).startsWith('Play again'))break;await page.locator('[data-step]').click();}
    const count=[14,13,40,8,14][index],sewn=index===1?37:40;assert.equal(await reading('Your result').textContent(),`${count} lockstitches · ${sewn.toFixed(1)} / 40 mm sewn`);assert.equal(await selected(),preset.part);await capture('complete-'+index);await page.locator('[data-result]').click();await page.locator('[data-view="top"]').click();await capture('top-'+index);await page.locator('[data-view="bottom"]').click();await capture('bottom-'+index);
    await page.locator('[data-play]').evaluate(b=>{b.click();b.click()});assert.equal(await reading('Fabric progress').textContent(),'0.0 / 40 mm advanced');assert.equal(await selected(),preset.part);assert.deepEqual(await values(),{...preset.values,threaded:1});await capture('replay-'+index);cases.push({width,index,count,sewn,replay:true});
   }
   await page.locator('[data-reset-controls]').click();await page.locator('[data-separation]').fill('100');await page.getByText('Fully separated',{exact:true}).waitFor();await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await capture('separated');await page.locator('[data-reassemble]').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.close();
  }
  assert.equal(cases.length,10);assert.deepEqual(errors,[]);await writeFile(out+'/browser.json',JSON.stringify({base,cases,errors},null,2)+'\n');console.log('PASS Bobbin: ten desktop/phone cases, case/loop views, missing-thread recovery, spacing, replay and separation.');
 }finally{await browser.close();}
}

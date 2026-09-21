import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createSewingModel} from './sewing-model.js';
import {utilityComponentLessons} from './utility-lessons.js';

const model=createSewingModel({hookLesson:true}),lesson=utilityComponentLessons['Rotary sewing hook'];
const out=process.env.EVIDENCE_DIR||'/tmp/howthingswork-rotary-hook';await mkdir(out,{recursive:true});
const object=id=>model.parts.find(p=>p.id===id).object,near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`),read=label=>model.getState().readings.find(r=>r.label===label).value;
const hook=object('hook'),nose=hook.children.find(p=>p.geometry?.type==='CylinderGeometry'),needle=object('needle'),eye=needle.children.find(p=>p.geometry?.type==='TorusGeometry'),loop=object('hook-assembly').children.find(p=>p.isInstancedMesh),pose=new THREE.Matrix4();
const hookPoint=()=>nose.localToWorld(new THREE.Vector3(0,nose.geometry.parameters.height/2,0));
const carriedPoint=()=>{loop.getMatrixAt(48,pose);return loop.localToWorld(new THREE.Vector3(0,.5,0).applyMatrix4(pose));};
let poses=0,contacts=0;const rotations=[];
for(const rate of [.5,1,3]){
 model.reset();model.update({rate});model.root.updateMatrixWorld(true);let previous=hookPoint(),angle=0;const start=previous.clone(),caseMatrix=object('bobbin-case').matrixWorld.clone();
 for(let i=1;i<=1000;i++){
  model.advance(.001/rate);model.root.updateMatrixWorld(true);const p=hookPoint(),a=Math.atan2(p.z-.15,p.y-.47),b=Math.atan2(previous.z-.15,previous.y-.47);angle+=Math.atan2(Math.sin(a-b),Math.cos(a-b));previous=p;
  near(p.x,-.92);near(Math.hypot(p.y-.47,p.z-.15),.30);assert.deepEqual(object('bobbin-case').matrixWorld.elements,caseMatrix.elements);near(object('hook-pulley').rotation.x,2*object('upper-pulley').rotation.x);assert.ok(Math.abs(parseFloat(read('Hook turns this cycle'))-model.getState().phase*2)<.000501);
  const actualEye=eye.getWorldPosition(new THREE.Vector3());assert.ok(Math.abs(parseFloat(read('Needle rise from bottom'))-(actualEye.y-.73))<.000501);
  if(i===500){assert.ok(p.distanceTo(start)<1e-7);near(actualEye.y,.73);assert.equal(read('Hook turns this cycle'),'1.000 turns');}
  if(i>=551&&i<=879){assert.ok(p.distanceTo(carriedPoint())<1e-6,'actual hook nose carries the red loop endpoint');contacts++;}
  assert.equal(model.getState().readings.length,12);assert.ok(model.getState().readings.every(r=>r.hint));poses++;
 }
 near(angle,4*Math.PI);assert.equal(model.getState().stitches.length,1);rotations.push({rate,turns:angle/(2*Math.PI)});
}
model.reset({phase:.55});model.root.updateMatrixWorld(true);const catchEye=eye.getWorldPosition(new THREE.Vector3()),catchPoint=hookPoint();loop.getMatrixAt(0,pose);const caught=loop.localToWorld(new THREE.Vector3(0,.5,0).applyMatrix4(pose));assert.ok(catchPoint.distanceTo(caught)<1e-6);near(catchPoint.y,.77);assert.ok(catchEye.y>.73&&catchEye.y<1.04);assert.ok(catchPoint.distanceTo(catchEye)>.07);assert.equal(read('Needle rise from bottom'),'0.023 model units');
model.reset({phase:.94});model.root.updateMatrixWorld(true);assert.ok(hookPoint().distanceTo(carriedPoint())>.1,'released loop no longer follows the hook nose');assert.ok(model.getState().takeUpRecovering);
const outcomes=[];
for(const [index,preset] of lesson.tryIt.entries()){
 assert.equal(preset.reset,true);assert.equal(preset.isolate,true);assert.equal(preset.cutaway,true);assert.deepEqual(Object.keys(preset.values).sort(),Object.keys(model.defaults).sort());model.reset();model.update(preset.values);
 if(index===4){model.playback.step();near(model.getState().sewn,0);near(model.getState().distance,3);model.update({threaded:1});model.playback.step();assert.deepEqual(model.getState().stitches,[{from:3,to:6}]);}
 model.advance(120);const state=model.getState();near(state.sewn,index===4?37:40);assert.equal(state.stitches.length,index===4?13:14);assert.equal(state.complete,true);outcomes.push({index,count:state.stitches.length,sewn:state.sewn});
}
assert.match(utilityComponentLessons['Needle and needle thread'].limits,/Needle flex, scarf geometry/);assert.match(utilityComponentLessons['Bobbin and bobbin thread'].limits,/winding depletion/);assert.match(lesson.limits,/enlarged open arc/);assert.ok(lesson.sources.some(s=>s.url.includes('JP2010005396A')));
model.dispose();await writeFile(out+'/model.json',JSON.stringify({poses,contacts,rotations,catchEye:catchEye.toArray(),catchPoint:catchPoint.toArray(),outcomes,authoredLimitsPreserved:true},null,2)+'\n');console.log('PASS Rotary hook: 3,000 actual nose poses, 987 loop contacts, two turns at three paces, early-rise catch, release and five exact outcomes.');
if(process.env.MODEL_ONLY!=='1'){
 const {chromium}=await import('playwright'),browser=await chromium.launch({headless:true}),base=process.env.SITE_URL||'http://127.0.0.1:5193/',cases=[],errors=[];
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'#machine/rotary-sewing-hook');await page.locator('[data-play]').waitFor();
   const reading=label=>page.locator('.daily-readings>div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd');
   const values=async()=>Object.fromEntries(await page.locator('[data-control]').evaluateAll(inputs=>inputs.map(input=>[input.dataset.control,Number(input.value)])));
   const capture=async name=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({path:`${out}/${name}-${width}.png`,clip:await page.locator('canvas').boundingBox()});};
   const renderedPixels=()=>page.evaluate(async()=>{document.querySelector('[data-control="length"]').dispatchEvent(new Event('input',{bubbles:true}));const source=document.querySelector('canvas'),copy=new OffscreenCanvas(source.width,source.height),context=copy.getContext('2d');context.drawImage(source,0,0);const pixels=context.getImageData(0,0,copy.width,copy.height).data;if(!pixels.some((value,i)=>i%4===0&&value<100&&pixels[i+1]<100&&pixels[i+2]<100))throw new Error('rendered canvas must contain dark case or hook geometry');return {width:copy.width,height:copy.height,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))).map(v=>v.toString(16).padStart(2,'0')).join('')};});
   const selected=()=>page.locator('.daily-part-path [data-parent]').last().getAttribute('data-parent');
   assert.equal(await selected(),'stitch-formation');assert.equal(await page.locator('[data-isolate]').isChecked(),true);await capture('opening');
   for(const [index,preset] of lesson.tryIt.entries()){
    await page.locator('[data-control="template"]').selectOption('1');await page.locator('[data-control="foot"]').selectOption('0');await page.locator('[data-control="threaded"]').selectOption('0');await page.locator('[data-number="length"]').fill('4');await page.locator('[data-number="length"]').press('Enter');await page.locator('[data-number="rate"]').fill('3');await page.locator('[data-number="rate"]').press('Enter');await page.locator('[data-isolate]').uncheck();await page.locator('[data-cutaway]').uncheck();await page.locator('[data-view="top"]').click();
    await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${index}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();assert.deepEqual(await values(),preset.values);assert.equal(await selected(),preset.part);assert.equal(await page.locator('[data-cutaway]').isChecked(),preset.cutaway);assert.equal(await page.locator('[data-isolate]').isChecked(),true);assert.equal(await reading('Fabric progress').textContent(),'0.0 / 40 mm advanced');assert.equal(await page.locator('.daily-readings>div').filter({has:page.locator('p')}).count(),12);
    await capture('setup-'+index);const start=await renderedPixels();await page.locator(`[data-view="${preset.view}"]`).click();await capture('view-check-'+index);assert.deepEqual(await renderedPixels(),start,'preset restores exact rendered preset view');
    assert.equal(await reading('Hook turns this cycle').textContent(),'0.000 turns');
    for(let i=0;i<2;i++)await page.getByRole('button',{name:'Next stitch stage',exact:true}).click();assert.equal(await reading('Cycle position').textContent(),'50.0%');assert.equal(await reading('Hook turns this cycle').textContent(),'1.000 turns');assert.equal(await reading('Needle rise from bottom').textContent(),'0.000 model units');await capture('one-turn-'+index);
    if(index===0){assert.deepEqual(await renderedPixels(),start,'one actual hook turn restores its rendered orientation');await page.locator('[data-control="foot"]').selectOption('0');await page.locator('[data-step]').click();assert.equal(await reading('Cycle position').textContent(),'50.0%');await page.locator('[data-control="foot"]').selectOption('1');}
    await page.getByRole('button',{name:'Next stitch stage',exact:true}).click();assert.equal(await reading('Cycle position').textContent(),'55.0%');assert.equal(await reading('Hook turns this cycle').textContent(),'1.100 turns');assert.equal(await reading('Needle rise from bottom').textContent(),'0.023 model units');await capture('catch-'+index);
    if(index===2){for(const [phase,turns] of [['70.0%','1.400 turns'],['84.0%','1.680 turns'],['94.0%','1.880 turns']]){await page.getByRole('button',{name:'Next stitch stage',exact:true}).click();assert.equal(await reading('Cycle position').textContent(),phase);assert.equal(await reading('Hook turns this cycle').textContent(),turns);if(phase==='94.0%')assert.ok(parseFloat(await reading('Take-up eye lift').textContent())>0);else assert.equal(await reading('Take-up eye lift').textContent(),'0.000 model units');await capture('carry-release-'+phase.replace('.0%',''));}}
    await page.locator('[data-step]').click();
    if(index===4){assert.equal(await reading('Your result').textContent(),'0 lockstitches · 0.0 / 40 mm sewn');assert.equal(await reading('Fabric progress').textContent(),'3.0 / 40 mm advanced');await capture('missing');await page.locator('[data-control="threaded"]').selectOption('1');await page.locator('[data-step]').click();assert.equal(await reading('Your result').textContent(),'1 lockstitch · 3.0 / 40 mm sewn');assert.equal(await reading('Fabric progress').textContent(),'6.0 / 40 mm advanced');await capture('restored');}
    else assert.equal(await reading('Your result').textContent(),`1 lockstitch · ${preset.values.length.toFixed(1)} / 40 mm sewn`);
    if(index===3){await page.locator('[data-play]').click();await page.waitForTimeout(250);await page.locator('[data-play]').click();const paused=await reading('Cycle position').textContent();await page.waitForTimeout(180);assert.equal(await reading('Cycle position').textContent(),paused);await page.locator('[data-play]').click();await page.waitForTimeout(150);await page.locator('[data-play]').click();}
    for(let i=0;i<41;i++){if((await page.locator('[data-play]').getAttribute('title')).startsWith('Play again'))break;await page.locator('[data-step]').click();}
    const count=[14,14,14,14,13][index],sewn=index===4?37:40;assert.equal(await reading('Your result').textContent(),`${count} lockstitches · ${sewn.toFixed(1)} / 40 mm sewn`);assert.equal(await selected(),preset.part);await capture('complete-'+index);await page.locator('[data-result]').click();await page.locator('[data-view="top"]').click();await capture('top-'+index);await page.locator('[data-view="bottom"]').click();await capture('bottom-'+index);
    await page.locator('[data-play]').evaluate(b=>{b.click();b.click()});assert.equal(await reading('Fabric progress').textContent(),'0.0 / 40 mm advanced');assert.equal(await selected(),preset.part);assert.deepEqual(await values(),{...preset.values,threaded:1});await capture('replay-'+index);cases.push({width,index,count,sewn,replay:true});
   }
   await page.locator('[data-reset-controls]').click();await page.locator('[data-separation]').fill('100');await page.getByText('Fully separated',{exact:true}).waitFor();await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await capture('separated');await page.locator('[data-reassemble]').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.close();
  }
  assert.equal(cases.length,10);assert.deepEqual(errors,[]);await writeFile(out+'/browser.json',JSON.stringify({base,cases,errors},null,2)+'\n');console.log('PASS Rotary hook: ten desktop/phone cases, repeated orientation, early-rise catch, carry/release, pace, missing-thread recovery, replay and separation.');
 }finally{await browser.close();}
}

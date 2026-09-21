import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createSewingModel} from './sewing-model.js';
import {utilityComponentLessons} from './utility-lessons.js';

const lesson=utilityComponentLessons.Lockstitch,model=createSewingModel();
assert.equal(model.actions[0].replay,false,'stage advancement must not be replayed as experiment setup');
const out=process.env.EVIDENCE_DIR||'/tmp/howthingswork-lockstitch';await mkdir(out,{recursive:true});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`),object=id=>model.parts.find(p=>p.id===id).object;
for(const preset of lesson.tryIt){
 assert.equal(preset.reset,true);assert.equal(preset.isolate,true);assert.equal(preset.cutaway,true);assert.equal(preset.view,'side');
 assert.deepEqual(Object.keys(preset.values).sort(),Object.keys(model.defaults).sort());
 model.reset();model.update(preset.values);assert.equal(model.getState().phase,0);assert.equal(model.getState().distance,0);
}
model.reset();const phases=[.14,.50,.55,.70,.84,.94,0],stageResults=[];
for(const phase of phases){model.actions[0].run();const s=model.getState();near(s.phase,phase);stageResults.push({phase,lift:s.takeUpHeight,stitches:s.stitches.length});}
const eyeLow=2.13+.45*Math.cos(1.05);for(const i of [1,2,3,4])near(stageResults[i].lift,eyeLow);assert.ok(stageResults[5].lift>eyeLow);assert.equal(stageResults[6].stitches,1);
const loop=object('hook-assembly').children.find(p=>p.isInstancedMesh),lower=object('bobbin-thread').children.find(p=>p.isInstancedMesh),pose=new THREE.Matrix4();
let threadPoses=0;
for(const threaded of [0,1])for(const phase of [.5,.55,.70,.84,.94]){
 model.reset({phase});model.update({threaded});model.root.updateMatrixWorld(true);assert.equal(lower.count,threaded?3:0);
 loop.getMatrixAt(0,pose);const start=loop.localToWorld(new THREE.Vector3(0,-.5,0).applyMatrix4(pose));
 assert.ok(start.distanceTo(object('needle').localToWorld(new THREE.Vector3(-.85,-.30,.15)))<1e-6,'Float32 instance endpoint remains attached to needle eye');
 for(let i=0;i<loop.count;i++){loop.getMatrixAt(i,pose);assert.ok(pose.elements.every(Number.isFinite));}threadPoses++;
}
const outcomes=[];
for(const [index,preset] of lesson.tryIt.entries()){
 model.reset();model.update(preset.values);
 if(index===1){model.playback.step();assert.equal(model.getState().sewn,0);near(model.getState().distance,3);model.update({threaded:1});model.playback.step();assert.deepEqual(model.getState().stitches,[{from:3,to:6}]);}
 model.advance(120);const s=model.getState();assert.equal(s.complete,true);near(s.distance,40);near(s.sewn,index===1?37:40);assert.equal(s.stitches.length,[14,13,40,8,14][index]);
 const seamMeshes=object('seam').children.filter(p=>p.isInstancedMesh&&p.geometry.type==='CylinderGeometry');assert.equal(seamMeshes.length,2);for(const mesh of seamMeshes)assert.equal(mesh.count,s.stitches.length*3);
 model.root.updateMatrixWorld(true);assert.ok(model.frameBoundsForPart('seam').containsBox(new THREE.Box3().setFromObject(object('seam'))),'full-template frame contains thread thickness and final puncture geometry');
 outcomes.push({index,stitches:s.stitches.length,sewn:s.sewn});
}
model.dispose();await writeFile(out+'/model.json',JSON.stringify({threadPoses,stageResults,outcomes},null,2)+'\n');console.log('PASS Lockstitch: five complete setups, seven stages, ten actual thread poses and five exact seam outcomes.');

if(process.env.MODEL_ONLY!=='1'){
 const {chromium}=await import('playwright'),browser=await chromium.launch({headless:true});const cases=[],errors=[];
 const base=process.env.SITE_URL||'http://127.0.0.1:5193/';
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base+'#machine/lockstitch');await page.locator('[data-play]').waitFor();
   const read=label=>page.locator('.daily-readings>div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd');
   const values=async()=>Object.fromEntries(await page.locator('[data-control]').evaluateAll(inputs=>inputs.map(input=>[input.dataset.control,Number(input.value)])));
   const capture=async name=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({path:`${out}/${name}-${width}.png`,clip:await page.locator('canvas').boundingBox()});};
   const renderedPixels=async()=>Buffer.from((await page.evaluate(()=>{document.querySelector('[data-control="length"]').dispatchEvent(new Event('input',{bubbles:true}));const canvas=document.querySelector('canvas'),copy=new OffscreenCanvas(canvas.width,canvas.height),context=copy.getContext('2d');context.drawImage(canvas,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;if(!pixels.some((value,i)=>i%4===2&&value>pixels[i-2]+20&&value>pixels[i-1]+10))throw new Error('rendered canvas must contain the blue seam');return canvas.toDataURL();})).split(',')[1],'base64');
   const samePixels=async(a,b)=>page.evaluate(async images=>{const pixels=await Promise.all(images.map(async data=>{const bitmap=await createImageBitmap(new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],{type:'image/png'})),canvas=new OffscreenCanvas(bitmap.width,bitmap.height),context=canvas.getContext('2d');context.drawImage(bitmap,0,0);const result={width:bitmap.width,height:bitmap.height,data:context.getImageData(0,0,bitmap.width,bitmap.height).data};bitmap.close();return result;}));return pixels[0].width===pixels[1].width&&pixels[0].height===pixels[1].height&&pixels[0].data.every((value,i)=>value===pixels[1].data[i]);},[a.toString('base64'),b.toString('base64')]);
   const setup=async index=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${index}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();};
   assert.equal(await page.locator('[data-isolate]').isChecked(),true);assert.equal(await page.locator('.daily-part-path [data-parent]').last().getAttribute('data-parent'),'stitch-formation');await capture('opening');
   for(const [index,preset] of lesson.tryIt.entries()){
    await page.locator('[data-control="template"]').selectOption('1');await page.locator('[data-control="foot"]').selectOption('0');await page.locator('[data-control="threaded"]').selectOption('0');await page.locator('[data-number="length"]').fill('4');await page.locator('[data-number="length"]').press('Enter');await page.locator('[data-number="rate"]').fill('3');await page.locator('[data-number="rate"]').press('Enter');
    await page.locator('[data-isolate]').uncheck();await page.locator('[data-cutaway]').uncheck();await page.locator('[data-view="top"]').click();
    await setup(index);assert.deepEqual(await values(),preset.values);assert.equal(await read('Fabric progress').textContent(),'0.0 / 40 mm advanced');assert.equal(await read('Cycle position').textContent(),'0.0%');assert.equal(await page.locator('[data-isolate]').isChecked(),true);assert.equal(await page.locator('[data-cutaway]').isChecked(),true);assert.equal(await page.locator('.daily-part-path [data-parent]').last().getAttribute('data-parent'),preset.part);
    assert.equal(await page.locator('.daily-readings>div').count(),10);assert.equal(await page.locator('.daily-readings>div').filter({has:page.locator('p')}).count(),10);
    const start=await capture('setup-'+index);await page.locator('[data-view="side"]').click();assert.equal(await samePixels(start,await capture('view-check-'+index)),true,'preset restores Side close-up');
    if(index===0){for(const [i,phase] of ['14.0%','50.0%','55.0%','70.0%','84.0%','94.0%'].entries()){await page.getByRole('button',{name:'Next stitch stage',exact:true}).click();assert.equal(await read('Cycle position').textContent(),phase);if(i>0)await capture('stage-'+phase.replace('.0%',''));}}
    if(index===1){await page.locator('[data-step]').click();assert.match(await read('Your result').textContent(),/^0 lockstitches/);assert.equal(await read('Fabric progress').textContent(),'3.0 / 40 mm advanced');await capture('missing');await page.locator('[data-control="threaded"]').selectOption('1');await page.locator('[data-step]').click();assert.equal(await read('Your result').textContent(),'1 lockstitch · 3.0 / 40 mm sewn');await page.locator('[data-result]').click();await page.locator('[data-view="top"]').click();await capture('gap-top');await page.locator('[data-view="bottom"]').click();await capture('gap-bottom');}
    if(index===4){for(let i=0;i<5;i++)await page.getByRole('button',{name:'Next stitch stage',exact:true}).click();assert.equal(await read('Take-up eye lift').textContent(),'0.000 model units');await capture('dwell');await page.getByRole('button',{name:'Next stitch stage',exact:true}).click();assert.ok(parseFloat(await read('Take-up eye lift').textContent())>0);await capture('recovery');}
    if(index===3){await page.locator('[data-play]').click();await page.waitForTimeout(400);await page.locator('[data-play]').click();const paused=await read('Cycle position').textContent();await page.waitForTimeout(250);assert.equal(await read('Cycle position').textContent(),paused);assert.notEqual(paused,'0.0%');await page.locator('[data-play]').click();await page.waitForTimeout(150);await page.locator('[data-play]').click();}
    for(let cycle=0;cycle<41;cycle++){if((await page.locator('[data-play]').getAttribute('title')).startsWith('Play again'))break;await page.locator('[data-step]').click();}
    const count=[14,13,40,8,14][index],sewn=index===1?37:40;assert.equal(await read('Your result').textContent(),`${count} lockstitches · ${sewn.toFixed(1)} / 40 mm sewn`);assert.equal(await read('Fabric progress').textContent(),'40.0 / 40 mm advanced');
    if(index!==1)assert.equal(await page.locator('.daily-part-path [data-parent]').last().getAttribute('data-parent'),preset.part);await capture('complete-'+index);const completedView=index===1?await renderedPixels():null;
    await page.locator('[data-result]').click();await page.locator('[data-view="top"]').click();await capture('top-'+index);await page.locator('[data-view="bottom"]').click();await capture('bottom-'+index);if(index===1)assert.equal(await samePixels(completedView,await renderedPixels()),true,'inspection follows the whole template as sewing continues at '+width+' px');
    await page.locator('[data-play]').evaluate(b=>{b.click();b.click()});assert.equal(await read('Fabric progress').textContent(),'0.0 / 40 mm advanced');assert.equal(await page.locator('[data-isolate]').isChecked(),true);assert.equal(await page.locator('.daily-part-path [data-parent]').last().getAttribute('data-parent'),preset.part);assert.deepEqual(await values(),{...preset.values,threaded:1});await capture('replay-'+index);
    cases.push({width,index,count,sewn,replay:true});
   }
   await page.locator('[data-reset-controls]').click();await page.locator('[data-separation]').fill('100');await page.getByText('Fully separated',{exact:true}).waitFor();await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await capture('separated');await page.locator('[data-reassemble]').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.close();
  }
  assert.equal(cases.length,10);assert.deepEqual(errors,[]);await writeFile(out+'/browser.json',JSON.stringify({base,cases,errors},null,2)+'\n');console.log('PASS Lockstitch: ten desktop/phone scenarios, exact setup views, stage/failure/spacing/dwell outcomes, pause, replay and separation.');
 }finally{await browser.close();console.log('Lockstitch browser closed.');}
}

import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createMeterModel} from './meter-model.js';
import {safetyLessons} from './safety-lessons.js';
import {chromium} from 'playwright';
import * as THREE from 'three';
import {createPartExplosion} from './part-explosion.js';

const base=process.env.SITE_URL||'http://127.0.0.1:5193/';
const out=process.env.EVIDENCE_DIR||'documentation/audit/evidence/electricity-meter-20260919';
await mkdir(out,{recursive:true});
const model=createMeterModel(),lesson=safetyLessons['Electricity meter'],TAU=Math.PI*2;
const near=(actual,expected,message)=>assert(Math.abs(actual-expected)<1e-8*Math.max(1,Math.abs(expected)),`${message}: ${actual} != ${expected}`);
const reset=(values={},initialState)=>{model.reset(initialState);model.update({...model.defaults,...values});};
const object=id=>model.parts.find(part=>part.id===id).object;
function geometry(){
 const s=model.getState();near(object('rotor').rotation.y,s.turns*TAU,'Disk follows integrated turns');near(object('worm').rotation.y,object('rotor').rotation.y,'Spindle drives worm');near(object('wheel').rotation.z,-s.turns*TAU/100,'100:1 reduction');near(object('pointer').rotation.z,object('wheel').rotation.z,'Pointer follows wheel');
}
let configurations=0;
for(let power=0;power<=2000;power+=100)for(let factor=2;factor<=10;factor++)for(let brake=5;brake<=15;brake++){
 reset({power,factor:factor/10,brake:brake/10});model.advance(17);model.advance(43);const s=model.getState();
 near(s.energy,power/60,'True Wh');near(s.registered,power/(60*(brake/10)**2),'Registered Wh');near(s.current,power/(120*factor/10),'RMS current');near(s.speed,power/(3600*(brake/10)**2),'Steady disk speed');near(s.turns,s.registered,'1 Wh per turn');assert(s.complete);geometry();configurations++;
}
for(let duration=1;duration<=10;duration++){reset({duration,power:2000});model.advance(duration*60+100);near(model.getState().energy,2000*duration/60,'Duration stops observation');near(model.getState().elapsed,duration*60,'Time boundary');geometry();}
for(let pace=1;pace<=30;pace++){reset({pace});model.playback.advance(.25);near(model.getState().elapsed,pace*.25,'Pace scales clock');near(model.getState().energy,600*pace*.25/3600,'Pace scales accumulation');}
reset();model.advance(30);model.update({power:1200});model.advance(30);near(model.getState().registered,15,'Load changes preserve history');
reset({brake:.5});model.advance(30);model.update({brake:1});model.advance(30);near(model.getState().registered,25,'Brake changes preserve history');near(model.getState().energy,10,'Calibration does not alter true energy');
reset();model.advance(30);model.update({power:0});const stopped=model.getState();model.advance(30);near(model.getState().registered,5,'Zero load retains previous energy');near(object('rotor').rotation.y,stopped.turns*TAU,'Zero load stops disk');assert(model.playback.complete());
model.update({duration:2,power:600});assert(!model.playback.complete());model.advance(60);near(model.getState().registered,15,'Longer observation resumes accumulation');model.update({duration:1});model.advance(10);near(model.getState().elapsed,120,'Shorter limit does not erase history');near(model.getState().registered,15,'Shorter limit preserves energy');
reset();for(const seconds of [NaN,Infinity,-1,0])model.advance(seconds);assert.equal(model.getState().elapsed,0);assert.equal(model.getState().energy,0);
model.update({power:Infinity,factor:NaN,brake:-5,duration:99,pace:-10});assert.deepEqual(model.getState().values,{power:600,duration:10,pace:1,factor:1,brake:.5});
for(const hz of [15,60,144]){reset({pace:30});for(let i=0;i<=2*hz;i++)model.playback.advance(1/hz);near(model.getState().elapsed,60,'Frame timing');near(model.getState().registered,10,'Frame-independent energy');}
const expected=[10,20,5,10,40],presets=[];
for(const [i,experiment] of lesson.tryIt.entries()){
 assert.equal(experiment.reset,true);assert.deepEqual(Object.keys(experiment.values).sort(),model.controls.map(c=>c.key).sort());
 reset({power:2000,brake:.5,duration:10,pace:30,factor:.2});model.advance(500);
 reset(experiment.values,experiment.initialState);near(model.getState().elapsed,i===2?30:0,'Independent preset time');near(model.getState().registered,i===2?5:0,'Independent preset history');
 const start=model.getState();while(!model.playback.complete())model.playback.step();const s=model.getState();near(s.registered,expected[i],'Preset outcome');near(s.energy,i===4?10:expected[i],'True preset energy');near(s.elapsed,60,'Preset duration');geometry();model.playback.step();near(model.getState().registered,expected[i],'Step after completion');
 presets.push({title:experiment.title,values:s.values,start:{elapsed:start.elapsed,registered:start.registered},result:{elapsed:s.elapsed,energy:s.energy,registered:s.registered,current:s.current,turns:s.turns}});
}
assert.equal(object('wheel').children.filter(child=>child.isMesh).length,101,'Wheel body and 100 teeth');
const camera=new THREE.PerspectiveCamera(40,1,0.1,100);camera.position.set(5,4,8);camera.lookAt(0,1.3,0);camera.updateMatrixWorld();
for(const aspect of [1.23,1.05]){
 const explosion=createPartExplosion(model,camera,aspect);explosion.update(1);
 const face=explosion.items.find(item=>item.id==='dial-face');assert(face,'Face remains a physical part');assert.equal(face.group.children.length,11,'Printed marks stay attached to face');
 for(let i=0;i<10;i++){assert(face.partIds.has('tick-'+i));assert(face.group.children.some(child=>child.userData.partId==='tick-'+i),'Marks remain individually inspectable');}
 assert.equal(explosion.categories.length,9);explosion.dispose();
}
model.dispose();await writeFile(out+'/model.json',JSON.stringify({configurations,presets,result:'PASS'},null,2)+'\n');
console.log('PASS meter model:',configurations,'power/factor/brake settings, all durations/paces, history, boundaries, geometry, frame timing and five independent presets.');

const browser=await chromium.launch({headless:true}),errors=[],cases=[];
let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 const reading=label=>page.locator('.daily-readings > div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd');
 const setup=async i=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();};
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await page.goto(base+'#machine/electricity-meter');await page.locator('[data-play]').waitFor();
  for(const [i,experiment] of lesson.tryIt.entries()){
   console.log(width,experiment.title);await setup(i);
   for(const [key,value] of Object.entries(experiment.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));
   assert.equal(await reading('Your result').textContent(),(i===2?'5.000':'0.000')+' Wh recorded');assert.equal(await reading('Observed time').textContent(),(i===2?'30.0':'0.0')+' / 60 s');
   await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Observation complete.'),null,{timeout:12000});
   assert.equal(await reading('Your result').textContent(),expected[i].toFixed(3)+' Wh recorded');assert.equal(await reading('Disk turns').textContent(),expected[i].toFixed(3));assert.equal(await reading('Actual appliance energy').textContent(),(i===4?10:expected[i]).toFixed(3)+' Wh');assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');
   assert.equal(await reading('RMS current').textContent(),(experiment.values.power/(120*experiment.values.factor)).toFixed(3)+' A');
   await page.locator('canvas').scrollIntoViewIfNeeded();await page.mouse.move(0,0);await page.screenshot({path:`${out}/preset-${width}-${i}.png`,clip:await page.locator('.daily-canvas-wrap').boundingBox()});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');cases.push({width,title:experiment.title,result:await reading('Your result').textContent(),time:await reading('Observed time').textContent()});
  }
  await setup(2);await page.locator('[data-step]').click();assert.equal(await reading('Observed time').textContent(),'40.0 / 60 s');assert.equal(await reading('Your result').textContent(),'5.000 Wh recorded');
  await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Observation complete.'));
  const replay=await page.locator('[data-play]').evaluate(button=>{button.click();return document.querySelector('.daily-readings').textContent;});assert.match(replay,/30.0 \/ 60 s/);assert.match(replay,/5.000 Wh recorded/);await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Observation complete.'));
  await page.locator('[data-reset-controls]').click();assert.equal(await reading('Your result').textContent(),'0.000 Wh recorded');
  await page.locator('[data-play]').click();await page.waitForTimeout(250);await page.locator('[data-play]').click();const paused=await reading('Observed time').textContent();await page.waitForTimeout(250);assert.equal(await reading('Observed time').textContent(),paused,'Pause freezes clock');
  await page.locator('[data-reset-controls]').click();await page.locator('[data-step]').click();assert.equal(await reading('Observed time').textContent(),'10.0 / 60 s');assert.equal(await reading('Your result').textContent(),'1.667 Wh recorded');
  await page.locator('[data-control="power"]').fill('0');await page.locator('[data-step]').click();assert.equal(await reading('Your result').textContent(),'1.667 Wh recorded');assert.equal(await reading('Disk speed').textContent(),'0.00 rpm');
  await page.locator('[data-control="power"]').fill('1200');await page.locator('[data-control="factor"]').fill('0.5');await page.locator('[data-control="brake"]').fill('0.5');await page.locator('[data-control="duration"]').fill('2');await page.locator('[data-control="pace"]').fill('30');await page.locator('[data-step]').click();assert.equal(await reading('Your result').textContent(),'15.000 Wh recorded');assert.equal(await reading('Actual appliance energy').textContent(),'5.000 Wh');assert.equal(await reading('RMS current').textContent(),'20.000 A');assert.equal(await reading('Observed time').textContent(),'30.0 / 120 s');
  await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Observation complete.'));assert.equal(await reading('Your result').textContent(),'135.000 Wh recorded');
  await page.locator('[data-result]').click();assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Energy register');await page.locator('.daily-heading h1').click();assert.equal(await page.locator('.daily-part-detail h3').count(),0);
  await page.locator('[data-view="reset"]').click();await page.locator('[data-separation]').fill('100');for(const view of ['in','out']){await page.locator(`[data-view="${view}"]`).click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');}
  await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/separated-${width}.png`,clip:await page.locator('.daily-canvas-wrap').boundingBox()});await page.locator('[data-reassemble]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'0');
 }
 assert.deepEqual(errors,[]);console.log('PASS meter browser: ten preset/viewport cases, seeded stop/replay, pause/reset/step, every control, retained history, result inspection, deselection and separated zoom.');
}catch(error){console.error(error);await page?.screenshot({path:out+'/failure.png',fullPage:true,timeout:5000}).catch(()=>{});throw error;}
finally{await writeFile(out+'/browser.json',JSON.stringify({base,browser:browser.version(),cases,errors},null,2)+'\n');await browser.close();}

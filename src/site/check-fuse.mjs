import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {createFuseModel} from './fuse-model.js';
import {createPartExplosion} from './part-explosion.js';
import {safetyLessons} from './safety-lessons.js';

const base=process.env.SITE_URL||'http://127.0.0.1:5193/';
const out=process.env.EVIDENCE_DIR||'documentation/audit/evidence/fuse-20260919';
await mkdir(out,{recursive:true});
const model=createFuseModel(),lesson=safetyLessons.Fuse;
const near=(a,b,message)=>assert(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${message}: ${a} != ${b}`);
const reset=(values={},initialState)=>{model.reset(initialState);model.update({...model.defaults,...values});};
const object=id=>model.parts.find(part=>part.id===id).object;
const element=object('element'),bridge=element.children[2],beads=element.children.slice(3);
const trip=resistance=>{const i=12/(resistance+.05);return 4*Math.log(i*i/(i*i-1));};
let configurations=0;
for(let resistance=6;resistance<=48;resistance+=.5)for(const power of [0,1]){
 reset({resistance,power});const current=power*12/(resistance+.05),target=current*current;
 const expected=target>1?trip(resistance):Infinity;assert.equal(Number.isFinite(model.getState().timeToMelt),target>1);if(target>1)near(model.getState().timeToMelt,expected,'Cold prediction');
 model.advance(100);const s=model.getState();assert.equal(s.melted,target>1);near(s.elapsed,target>1?expected:100,'Exact observation boundary');near(s.heat,target>1?1:target*(1-Math.exp(-25)),'Thermal state');near(s.current,target>1?0:current,'Circuit current');near(s.power,s.current*s.current*resistance,'Lamp power');
 assert.equal(bridge.visible,!s.melted);for(const bead of beads)assert.equal(bead.visible,s.melted);configurations++;
}
reset({resistance:6});const predicted=model.getState().timeToMelt;model.advance(.25);near(model.getState().timeToMelt,predicted-.25,'Remaining time falls with observation');model.advance(.75);const hot=model.getState().heat;model.update({power:0});model.advance(1);near(model.getState().heat,hot*Math.exp(-.25),'Interrupted overload cools');assert(!model.getState().melted);assert.equal(model.getState().timeToMelt,Infinity);
model.update({power:1,resistance:10});assert(model.getState().timeToMelt<trip(10),'Warm fuse melts sooner');model.advance(100);assert(model.getState().melted);const stopped=model.getState();model.playback.step();near(model.getState().elapsed,stopped.elapsed,'Completed observation stays frozen');near(model.getState().heat,1,'Snapshot stays at melting');
model.update({resistance:24,power:0});assert.equal(model.getState().current,0);assert.equal(bridge.visible,false);model.actions[0].run();assert.equal(bridge.visible,true);assert.equal(model.getState().current,0);assert.equal(model.getState().heat,0);model.update({power:1});assert(model.getState().current>0);
reset({}, {melted:true});assert(model.getState().melted);near(model.getState().elapsed,trip(6),'Prepared state comes from actual overload integration');assert(model.playback.blocked());assert(!model.playback.complete());model.actions[0].run();assert(!model.playback.blocked());assert(!model.getState().melted);near(model.getState().elapsed,trip(6),'Replacement preserves observation time');
for(const hz of [15,60,144]){reset({resistance:6});while(!model.playback.complete())model.playback.advance(1/hz);near(model.getState().elapsed,trip(6),'Frame-independent melting time');}
reset();for(const dt of [NaN,Infinity,-1,0])model.advance(dt);assert.equal(model.getState().elapsed,0);model.update({resistance:NaN,power:Infinity});assert.deepEqual(model.getState().values,model.defaults);
const presets=[];
for(const [i,experiment] of lesson.tryIt.entries()){
 assert(experiment.reset);assert.deepEqual(Object.keys(experiment.values).sort(),model.controls.map(c=>c.key).sort());reset({resistance:6});model.advance(20);reset(experiment.values,experiment.initialState);
 const start=model.getState();assert.equal(start.melted,i===2);near(start.heat,i===2?1:0,'Independent preset heat');
 if(i===0){model.advance(60);assert(!model.getState().melted);assert(model.getState().heat<.25);}
 else if(i===2){assert(model.playback.blocked());assert.equal(model.getState().current,0);model.actions[0].run();model.advance(60);assert(!model.getState().melted);assert(model.getState().current>0);}
 else if(i===3){model.playback.step();model.update({power:0});model.playback.step();assert(!model.getState().melted);near(model.getState().heat,(12/6.05)**2*(1-Math.exp(-.25))*Math.exp(-.25),'Interrupted preset heat');}
 else{model.advance(20);assert(model.getState().melted);near(model.getState().elapsed,trip(experiment.values.resistance),'Overload preset time');}
 const s=model.getState();presets.push({title:experiment.title,initialMelted:start.melted,result:{melted:s.melted,heat:s.heat,elapsed:s.elapsed,current:s.current}});
}
reset();const camera=new THREE.PerspectiveCamera(40,1,.1,100);camera.position.set(4,3,6);camera.lookAt(0,.7,0);camera.updateMatrixWorld();
const explosion=createPartExplosion(model,camera,1.2);explosion.update(1);assert.equal(explosion.categories.length,4,'Only supply, cartridge, lamp and wire categories');assert.equal(explosion.items.filter(item=>item.id==='wiring').length,3,'Each continuous wire stays together');assert.equal(explosion.items.find(item=>item.id==='filament').category,'load','Filament stays with lamp');for(const id of ['inlet-cap','outlet-cap','enclosure','element'])assert.equal(explosion.items.find(item=>item.id===id).category,'fuse');explosion.dispose();model.dispose();
await writeFile(out+'/model.json',JSON.stringify({configurations,presets,result:'PASS'},null,2)+'\n');console.log('PASS fuse model: 170 settings, analytic delay, hot/cold history, interruption, frozen completion, persistent gap, replacement, frame timing, five independent presets and physical grouping.');

const browser=await chromium.launch({headless:true}),errors=[],cases=[];let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 const reading=label=>page.locator('.daily-readings > div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd');
 const setup=async i=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();};
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await page.goto(base+'#machine/fuse');await page.locator('[data-play]').waitFor();
  for(const [i,experiment] of lesson.tryIt.entries()){
   console.log(width,experiment.title);await setup(i);for(const [key,value] of Object.entries(experiment.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));
   assert.equal(await reading('Element heating').textContent(),(i===2?'100.0':'0.0')+'% of melting rise');assert.equal(await page.locator('[data-play]').isDisabled(),i===2);
   if(i===2){assert.match(await reading('Your result').textContent(),/Fuse melted/);assert.match(await page.locator('[data-play]').getAttribute('title'),/Replace/);await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/prepared-gap-${width}.png`,clip:await page.locator('.daily-canvas-wrap').boundingBox()});await page.getByRole('button',{name:'Replace the fuse',exact:true}).click();assert.equal(await page.locator('[data-play]').isDisabled(),false);assert.equal(await reading('Circuit current').textContent(),'0.499 A');assert.equal(await reading('Element heating').textContent(),'0.0% of melting rise');}
   if(i===1||i===4){assert.equal(await reading('Time to melt').textContent(),trip(experiment.values.resistance).toFixed(2)+' s');await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Fuse melted'));assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');assert.equal(await reading('Time observed').textContent(),trip(experiment.values.resistance).toFixed(2)+' s');assert.equal(await reading('Lamp power').textContent(),'0.00 W');}
   else if(i===3){await page.locator('[data-step]').click();assert.equal(await reading('Element heating').textContent(),'87.0% of melting rise');await page.locator('[data-control="power"]').selectOption('0');await page.locator('[data-step]').click();assert.equal(await reading('Element heating').textContent(),'67.8% of melting rise');assert.equal(await reading('Time to melt').textContent(),'No melt at this setting');}
   else{await page.locator('[data-play]').click();await page.waitForTimeout(350);await page.locator('[data-play]').click();const paused=await reading('Time observed').textContent();await page.waitForTimeout(200);assert.equal(await reading('Time observed').textContent(),paused);assert.match(await reading('Your result').textContent(),/Element intact/);assert.equal(await reading('Time to melt').textContent(),'No melt at this setting');}
   await page.locator('canvas').scrollIntoViewIfNeeded();await page.mouse.move(0,0);await page.screenshot({path:`${out}/preset-${width}-${i}.png`,clip:await page.locator('.daily-canvas-wrap').boundingBox()});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));cases.push({width,title:experiment.title,result:await reading('Your result').textContent(),time:await reading('Time observed').textContent()});
  }
  const replay=await page.locator('[data-play]').evaluate(button=>{button.click();return document.querySelector('.daily-readings').textContent;});assert.match(replay,/Element intact/);assert.match(replay,/0.00 s/);await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Fuse melted'));const end=await reading('Time observed').textContent();await page.locator('[data-step]').click();assert.equal(await reading('Time observed').textContent(),end);
  await page.locator('[data-control="resistance"]').fill('24');assert.equal(await reading('Circuit current').textContent(),'0.000 A');await page.getByRole('button',{name:'Replace the fuse',exact:true}).click();assert.equal(await reading('Circuit current').textContent(),'0.499 A');
  await page.locator('[data-result]').click();assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Fusible element');await page.locator('.daily-heading h1').click();assert.equal(await page.locator('.daily-part-detail h3').count(),0);
  await page.locator('[data-reset-controls]').click();assert.equal(await reading('Time observed').textContent(),'0.00 s');await page.locator('[data-view="reset"]').click();await page.locator('[data-separation]').fill('100');assert.equal(await page.locator('.daily-inventory-labels [data-category]').count(),4);
  for(const view of ['in','out']){await page.locator(`[data-view="${view}"]`).click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');}await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/separated-${width}.png`,clip:await page.locator('.daily-canvas-wrap').boundingBox()});await page.locator('[data-reassemble]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'0');
 }
 assert.deepEqual(errors,[]);console.log('PASS fuse browser: ten independent preset/viewport cases, prepared gap, physical replacement, analytic delay, cooling, blocked-state hint, pause/reset/replay, persistent gap, result dismissal and separated zoom.');
}catch(error){console.error(error);await page?.screenshot({path:out+'/failure.png',fullPage:true,timeout:5000}).catch(()=>{});throw error;}
finally{await writeFile(out+'/browser.json',JSON.stringify({base,browser:browser.version(),cases,errors},null,2)+'\n');await browser.close();}

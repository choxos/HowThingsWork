import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {createConsumerModel} from './consumer-model.js';
import {createPartExplosion} from './part-explosion.js';
import {safetyLessons} from './safety-lessons.js';

const base=process.env.SITE_URL||'http://127.0.0.1:5193/',out=process.env.EVIDENCE_DIR||'documentation/audit/evidence/consumer-unit-20260919';await mkdir(out,{recursive:true});
const model=createConsumerModel(),lesson=safetyLessons['Consumer unit'];
const near=(a,b,message)=>assert(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${message}: ${a} != ${b}`);
const reset=(values={},state)=>{model.reset(state);model.update({...model.defaults,...values});};
const part=id=>model.parts.find(p=>p.id===id),object=id=>part(id).object;
const current=count=>count?12/(24/count+.05):0;
const trip=count=>{const target=current(count)**2;return target>1?4*Math.log(target/(target-1)):Infinity;};
function geometry(){
 const s=model.getState(),v=s.values;model.root.updateMatrixWorld(true);
 for(const y of [.62,.32]){
  const pole=object('main-pole-'+y),tip=pole.localToWorld(new THREE.Vector3(.4,0,0)),seat=new THREE.Vector3(-.7,y,.04);if(v.main)near(tip.distanceTo(seat),0,'Closed main contact touches');else assert(tip.distanceTo(seat)>.25,'Open main contact has a gap');
  const link=object('main-handle').localToWorld(new THREE.Vector3(0,y-.47,0)),pin=pole.localToWorld(new THREE.Vector3(.12,0,.05));near(link.distanceTo(pin),0,'Handle joins both moving poles');
 }
 for(const [i,count] of [v.kitchen,v.study].entries())for(let j=0;j<4;j++){
  const x=i ? .65 : -.35,y=1.92+j*.36,tip=object(`lamp-switch-${i}-${j}`).localToWorld(new THREE.Vector3(.06,0,0)),seat=new THREE.Vector3(x-.06,y-.14,.04);
  if(j<count)near(tip.distanceTo(seat),0,'Active local switch touches');else assert(tip.distanceTo(seat)>.03,'Inactive local switch opens');
  assert.equal(object(`lamp-${i}-${j}`).children[0].material.emissiveIntensity>0,Boolean(v.main&&!s.blown[i]&&j<count),'Light matches complete electrical path');
 }
 for(let i=0;i<2;i++)assert.equal(object('fuse-'+i).children[5].visible,!s.blown[i],'Visible fuse gap matches state');
}
let configurations=0;
for(let kitchen=0;kitchen<=4;kitchen++)for(let study=0;study<=4;study++)for(const main of [0,1]){
 reset({kitchen,study,main});const initial=model.getState();for(const [i,count] of [kitchen,study].entries())near(initial.currents[i],main*current(count),'Initial current');geometry();model.advance(15);const s=model.getState();near(s.elapsed,10,'Observation boundary');
 for(const [i,count] of [kitchen,study].entries()){
  const target=(main*current(count))**2,blown=target>1;assert.equal(s.blown[i],blown);near(s.currents[i],blown?0:main*current(count),'Post-observation branch current');near(s.heat[i],blown?Math.exp(-(10-trip(count))/4):target*(1-Math.exp(-2.5)),'Independent thermal history');
 }
 near(s.total,s.currents[0]+s.currents[1],'Supply current sum');geometry();configurations++;
}
reset({kitchen:4});model.advance(1);near(model.getState().timeToMelt[0],trip(4)-1,'Warm remaining delay');const hot=model.getState().heat;model.update({main:0});model.advance(1);for(let i=0;i<2;i++)near(model.getState().heat[i],hot[i]*Math.exp(-.25),'Main-off cooling');assert.deepEqual(model.getState().blown,[false,false]);
reset({}, {kitchenBlown:true});let s=model.getState();assert.deepEqual(s.blown,[true,false]);near(s.elapsed,2,'Prepared history time');near(s.heat[0],Math.exp(-(2-trip(4))/4),'Prepared melted branch cools');const intactHeat=s.heat[1];model.actions[0].run();s=model.getState();assert.deepEqual(s.blown,[false,false]);assert.equal(s.heat[0],0);near(s.heat[1],intactHeat,'Replacement preserves intact branch heat');assert.equal(s.elapsed,0);
model.advance(3);const before=model.getState();model.actions[0].run();assert.equal(model.getState().elapsed,3,'No blown fuse means no replacement clock reset');assert.deepEqual(model.getState().heat,before.heat);model.actions[1].run();assert.equal(model.getState().elapsed,0,'Restart updates state immediately');assert.deepEqual(model.getState().heat,before.heat);
reset({kitchen:4,study:4});model.advance(10);const broken=model.getState();model.actions[1].run();assert.deepEqual(model.getState().blown,[true,true]);assert.deepEqual(model.getState().heat,broken.heat);model.advance(1);for(let i=0;i<2;i++)near(model.getState().heat[i],broken.heat[i]*Math.exp(-.25),'Restart continues cooling an open fuse');
for(const hz of [15,60,144]){reset({kitchen:4,study:3});for(let i=0;i<=10*hz;i++)model.advance(1/hz);for(const [i,count] of [4,3].entries())near(model.getState().heat[i],Math.exp(-(10-trip(count))/4),'Frame-independent cooling after melt');near(model.getState().elapsed,10,'Exact completion');}
reset();for(const dt of [NaN,Infinity,-1,0])model.advance(dt);assert.equal(model.getState().elapsed,0);model.update({kitchen:99,study:-4,main:NaN});assert.deepEqual(model.getState().values,{kitchen:4,study:0,main:1});
const presets=[];
for(const [i,experiment] of lesson.tryIt.entries()){
 assert(experiment.reset);assert.deepEqual(Object.keys(experiment.values).sort(),model.controls.map(c=>c.key).sort());reset({kitchen:4,study:4});model.advance(10);reset(experiment.values,experiment.initialState);assert.deepEqual(model.getState().blown,i===2?[true,false]:[false,false]);
 if(i===2)model.actions[0].run();if(i===3){model.update({main:0});assert.equal(model.getState().total,0);geometry();model.update({main:1});}
 model.advance(10);const s=model.getState(),expected=i===1?[true,false]:i===4?[false,true]:i===5?[true,true]:[false,false];assert.deepEqual(s.blown,expected);geometry();presets.push({title:experiment.title,blown:s.blown,currents:s.currents,heat:s.heat});
}
assert.equal(new Set(model.parts.map(p=>p.name)).size,model.parts.length,'Every part has an unambiguous name');reset();model.covers.forEach(cover=>cover.visible=false);const camera=new THREE.PerspectiveCamera(40,1,.1,100);camera.position.set(5,4,8);camera.lookAt(0,1.5,0);camera.updateMatrixWorld();const explosion=createPartExplosion(model,camera,1.2);explosion.update(1);assert.equal(explosion.categories.length,9);assert.equal(explosion.items.filter(item=>item.id==='wires').length,2,'Supply leads are distinct continuous pieces');for(let i=0;i<2;i++){const wires=explosion.items.filter(item=>item.id==='branch-wires-'+i);assert.equal(wires.length,15);assert(wires.every(item=>item.category==='branch-'+i));for(let j=0;j<4;j++)assert.equal(part(`lamp-switch-${i}-${j}`).parentId,`lamp-${i}-${j}`);}explosion.dispose();model.dispose();
await writeFile(out+'/model.json',JSON.stringify({configurations,presets,result:'PASS'},null,2)+'\n');console.log('PASS consumer model: 50 settings, independent heat and prediction, physical main/local contacts, light/gap geometry, replacement/restart history, six presets and grouped wiring.');

const browser=await chromium.launch({headless:true}),errors=[],cases=[];let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 const reading=label=>page.locator('.daily-readings > div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd');
 const setup=async i=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();};
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await page.goto(base+'#machine/consumer-unit');await page.locator('[data-play]').waitFor();
  for(const [i,experiment] of lesson.tryIt.entries()){
   console.log(width,experiment.title);await setup(i);for(const [key,value] of Object.entries(experiment.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));
   assert.equal(await reading('Observed time').textContent(),(i===2?'2.00':'0.00')+' / 10 s');
   if(i===2){assert.equal(await reading('Kitchen branch').textContent(),'Fuse melted · no current');assert.equal(await reading('Study branch').textContent(),'0.499 A');await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/prepared-${width}.png`,clip:await page.locator('.daily-canvas-wrap').boundingBox()});await page.getByRole('button',{name:'Replace blown fuses',exact:true}).click();assert.equal(await reading('Fuse heat').textContent(),'0% / 10%');assert.equal(await reading('Kitchen branch').textContent(),'0.499 A');}
   if(i===3){await page.locator('[data-control="main"]').selectOption('0');assert.equal(await reading('Supply current').textContent(),'0.000 A');}
   await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('10.00 / 10 s'),null,{timeout:20000});assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');
   const expected=i===1?'Kitchen off · study still lit':i===3?'Main isolator open · both branches off':i===4?'Study off · kitchen still lit':i===5?'Both fuses melted · both branches off':'Connected lamps lit';assert.equal(await reading('Your result').textContent(),expected);
   const kitchenBlown=i===1||i===5,studyBlown=i===4||i===5;assert.equal(await reading('Kitchen fuse delay').textContent(),kitchenBlown?'Element already open':'No melt at this setting');assert.equal(await reading('Study fuse delay').textContent(),studyBlown?'Element already open':'No melt at this setting');
   await page.locator('canvas').scrollIntoViewIfNeeded();await page.mouse.move(0,0);await page.screenshot({path:`${out}/preset-${width}-${i}.png`,clip:await page.locator('.daily-canvas-wrap').boundingBox()});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));cases.push({width,title:experiment.title,result:expected,heat:await reading('Fuse heat').textContent()});
   if(i===3){await page.locator('[data-control="main"]').selectOption('1');assert.equal(await reading('Supply current').textContent(),'0.998 A');assert.equal(await reading('Your result').textContent(),'Connected lamps lit');}
  }
  const retained=await reading('Fuse heat').textContent();await page.getByRole('button',{name:'Restart observation',exact:true}).click();assert.equal(await reading('Fuse heat').textContent(),retained);assert.equal(await reading('Observed time').textContent(),'0.00 / 10 s');assert.equal(await reading('Your result').textContent(),'Both fuses melted · both branches off');await page.locator('[data-step]').click();assert.equal(await reading('Observed time').textContent(),'1.00 / 10 s');
  await setup(0);await page.locator('[data-play]').click();await page.waitForTimeout(300);await page.locator('[data-play]').click();const paused=await reading('Observed time').textContent();await page.waitForTimeout(200);assert.equal(await reading('Observed time').textContent(),paused);await page.getByRole('button',{name:'Replace blown fuses',exact:true}).click();assert.equal(await reading('Observed time').textContent(),paused);
  await page.locator('[data-reset-controls]').click();await page.locator('[data-control="kitchen"]').fill('0');await page.locator('[data-control="study"]').fill('0');assert.equal(await reading('Supply current').textContent(),'0.000 A');assert.equal(await reading('Your result').textContent(),'No lamps drawing current');
  await setup(2);await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('10.00 / 10 s'));const replay=await page.locator('[data-play]').evaluate(button=>{button.click();return document.querySelector('.daily-readings').textContent;});assert.match(replay,/Kitchen off · study still lit/);assert.match(replay,/2.00 \/ 10 s/);await page.locator('[data-play]').click();
  await page.locator('[data-result]').click();assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Two independently fused circuits');await page.locator('.daily-heading h1').click();assert.equal(await page.locator('.daily-part-detail h3').count(),0);await page.locator('[data-view="reset"]').click();await page.locator('[data-separation]').fill('100');assert.equal(await page.locator('.daily-inventory-labels [data-category]').count(),9);for(const view of ['in','out']){await page.locator(`[data-view="${view}"]`).click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');}await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/separated-${width}.png`,clip:await page.locator('.daily-canvas-wrap').boundingBox()});await page.locator('[data-reassemble]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'0');
 }
 assert.deepEqual(errors,[]);console.log('PASS consumer browser: twelve independent preset/viewport cases, physical replacement, isolated faults, linked main switch, restart/no-op history, zero loads, seeded replay, pause/reset, selection dismissal and separated zoom.');
}catch(error){console.error(error);await page?.screenshot({path:out+'/failure.png',fullPage:true,timeout:5000}).catch(()=>{});throw error;}
finally{await writeFile(out+'/browser.json',JSON.stringify({base,browser:browser.version(),cases,errors},null,2)+'\n');await browser.close();}

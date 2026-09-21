import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {createEarthModel} from './earth-model.js';
import {createPartExplosion} from './part-explosion.js';
import {safetyLessons} from './safety-lessons.js';

const base=process.env.SITE_URL||'http://127.0.0.1:5193/',out=process.env.EVIDENCE_DIR||'documentation/audit/evidence/protective-earth-20260919';await mkdir(out,{recursive:true});
const model=createEarthModel(),lesson=safetyLessons['Protective earth wire'];
const near=(a,b,message)=>assert(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${message}: ${a} != ${b}`);
const reset=(values={},state)=>{model.reset(state);model.animate(0);model.update({...model.defaults,...values});};
const object=id=>model.parts.find(p=>p.id===id).object;
function geometry(){
 const s=model.getState(),v=s.values;model.root.updateMatrixWorld(true);
 const tip=object('blade').localToWorld(new THREE.Vector3(.4,0,0)),seat=new THREE.Vector3(-.65,1.45,.12);
 if(s.tripped)assert(tip.distanceTo(seat)>.3,'Open protective contact has a gap');else near(tip.distanceTo(seat),0,'Closed protective contact touches');
 const faultTip=object('fault').localToWorld(new THREE.Vector3(.3,0,0));
 if(v.fault)near(faultTip.distanceTo(new THREE.Vector3(.2,1.2,.12)),0,'Fault bridge meets case');else assert(faultTip.x<.15,'Open fault bridge clears case wall');
 const lamp=object('lamp');assert.equal(lamp.children[2].material.emissiveIntensity>0,!s.tripped,'Lamp light follows contact');
 const points=[[.3,.2,.12],[.3,0,.12],[-.35,0,.12],[-.65,0,.12],[-1.5,0,.12],[-1.5,.2,0]].map(p=>new THREE.Vector3(...p));
 for(const dot of object('flow').children){
  assert.equal(dot.visible,s.earthCurrent>0,'Markers require actual fault current');
  const distance=Math.min(...points.slice(1).map((p,i)=>new THREE.Line3(points[i],p).closestPointToPoint(dot.position,true,new THREE.Vector3()).distanceTo(dot.position)));
  near(distance,0,'Conventional current marker stays on protective path');
 }
 for(const id of ['supply-wire','load-wire','return-wire']){
  const meshes=object(id).children;
  for(let i=1;i<meshes.length;i++){
   const a=meshes[i-1],b=meshes[i],end=a.localToWorld(new THREE.Vector3(0,a.geometry.parameters.height/2,0)),start=b.localToWorld(new THREE.Vector3(0,-b.geometry.parameters.height/2,0));near(end.distanceTo(start),0,'A continuous lead has no internal gaps');
  }
 }
}
let configurations=0;
for(const fault of [0,1])for(const earth of [0,1])for(let n=1;n<=100;n++){
 const resistance=n*.2;reset({fault,earth,resistance});const s=model.getState();
 const bus=12/(1+.2/24+(fault&&earth?.2/(.2+resistance):0));
 near(s.bus,bus,'Loaded branch voltage');near(s.total,s.loadCurrent+s.earthCurrent,'KCL');near(12,.2*s.total+s.bus,'Source loop KVL');
 near(s.loadCurrent,bus/24,'Lamp Ohm law');near(s.earthCurrent,fault&&earth?bus/(.2+resistance):0,'Fault-branch Ohm law');
 if(fault&&earth){near(s.bus,.2*s.earthCurrent+s.caseVoltage,'Fault branch KVL');near(s.caseVoltage,resistance*s.earthCurrent,'Case voltage');near(s.loopResistance,.4+resistance,'Complete loop resistance');}
 else {assert.equal(s.loopResistance,Infinity);if(!fault&&!earth)assert.equal(s.caseVoltage,null);else near(s.caseVoltage,fault?bus:0,'Bonded or unbonded case');}
 const shouldTrip=s.total>1.5;geometry();model.advance(.49);assert.equal(model.getState().tripped,false);model.advance(.01);assert.equal(model.getState().tripped,shouldTrip);geometry();model.advance(20);assert.equal(model.getState().elapsed,3);assert.equal(model.getState().total===0,shouldTrip);assert.equal(model.getState().complete,true);const completed=model.getState();model.advance(1);assert.deepEqual(model.getState(),completed,'Completed state freezes');configurations++;
}
for(const interruption of [{fault:0},{earth:0},{resistance:20}]){
 reset({fault:1});model.advance(.3);near(model.getState().exposure,.3,'Initial qualification');model.update(interruption);assert.equal(model.getState().exposure,0,'Paused interruption clears progress');model.update({fault:1,earth:1,resistance:.2});model.advance(.2);assert.equal(model.getState().tripped,false,'Separate faults do not accumulate');model.advance(.3);assert.equal(model.getState().tripped,true);
}
reset({fault:1});model.advance(.3);model.actions[1].run();assert.equal(model.getState().elapsed,0,'Restart refreshes clock immediately');near(model.getState().timeToTrip,.2,'Restart preserves continuous qualification');model.advance(.2);assert.equal(model.getState().tripped,true);model.actions[1].run();assert.equal(model.getState().tripped,true,'Restart cannot repair contact');model.update({fault:0});assert.equal(model.getState().tripped,true,'Fault removal does not reset latch');model.actions[0].run();assert.equal(model.getState().tripped,false);assert(model.getState().loadCurrent>0);
for(const frames of [1,3,30,60,144]){reset({fault:1});for(let i=0;i<frames;i++)model.advance(.5/frames);assert.equal(model.getState().tripped,true,`Half-second trip at ${frames} frames`);near(model.getState().elapsed,.5,'Frame-independent time');}
reset({fault:1});for(const dt of [NaN,Infinity,-1,0])model.advance(dt);assert.equal(model.getState().elapsed,0);model.update({fault:NaN,earth:Infinity,resistance:NaN});assert.deepEqual(model.getState().values,{fault:1,earth:1,resistance:.2});model.update({resistance:-1});assert.equal(model.getState().values.resistance,.2);model.update({resistance:99});assert.equal(model.getState().values.resistance,20);
const presets=[];
for(const [i,experiment] of lesson.tryIt.entries()){
 reset({fault:1});model.advance(3);assert(experiment.reset);assert.deepEqual(Object.keys(experiment.values).sort(),Object.keys(model.defaults).sort());reset(experiment.values,experiment.initialState);const initial=model.getState();
 assert.equal(initial.elapsed,i===5?.3:i===6?.5:0);assert.equal(initial.exposure,i===6?.5:0);assert.equal(model.playback.blocked(),i===6);
 if(i===5){model.update({fault:1});for(let j=0;j<4;j++)model.playback.step();assert.equal(model.getState().tripped,false);near(model.getState().exposure,.4,'Fresh fault needs new qualification');model.playback.step();assert.equal(model.getState().tripped,true);near(model.getState().elapsed,.8,'Interrupted fault trips only after fresh half-second');}
 if(i===6){model.advance(1);assert.equal(model.getState().elapsed,.5,'Prepared open contact waits for reset');model.actions[0].run();assert.equal(model.playback.blocked(),false);assert(model.getState().earthCurrent>0);}
 model.advance(3);const s=model.getState();assert.equal(s.tripped,[1,5,6,7].includes(i));geometry();presets.push({title:experiment.title,initialTime:initial.elapsed,tripped:s.tripped,caseVoltage:s.caseVoltage,total:s.total});
}
reset();model.covers.forEach(c=>c.visible=false);const camera=new THREE.PerspectiveCamera(40,1,.1,100);camera.position.set(5,4,8);camera.lookAt(0,.7,0);camera.updateMatrixWorld();const explosion=createPartExplosion(model,camera,1.2);explosion.update(1);assert.equal(explosion.categories.length,8);assert.equal(explosion.items.filter(p=>p.category==='wires').length,3);assert.equal(explosion.items.filter(p=>p.category==='sleeves').length,2);assert.equal(explosion.items.filter(p=>p.category==='earth').length,1);assert.equal(new Set(model.parts.map(p=>p.name)).size,model.parts.length);explosion.dispose();model.dispose();
await writeFile(out+'/model.json',JSON.stringify({configurations,presets,result:'PASS'},null,2)+'\n');console.log('PASS earth model: 400 settings, KCL/KVL, contact and continuous-wire geometry, marker paths, exact trip, interrupted faults, restart/latch/reset, frame rates, nine independent presets and eight separation categories.');
if(process.env.MODEL_ONLY==='1')process.exit(0);

const browser=await chromium.launch({headless:true}),errors=[],cases=[];let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 const reading=label=>page.locator('.daily-readings > div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd');
 const setup=async i=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();};
 const picture=async name=>{await page.locator('canvas').scrollIntoViewIfNeeded();await page.mouse.move(0,0);await page.screenshot({path:`${out}/${name}.png`,clip:await page.locator('.daily-canvas-wrap').boundingBox()});};
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await page.goto(base+'#machine/protective-earth-wire');await page.locator('[data-play]').waitFor();
  for(const [i,experiment] of lesson.tryIt.entries()){
   console.log(width,experiment.title);await setup(i);for(const [key,value] of Object.entries(experiment.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));
   assert.equal(await reading('Observed time').textContent(),(i===5?'0.30':i===6?'0.50':'0.00')+' / 3 s');
   if(i===1||i===6)await picture(`initial-${width}-${i}`);
   if(i===5){assert.equal(await reading('Trip progress').textContent(),'0%');await page.locator('[data-control="fault"]').selectOption('1');for(let j=0;j<4;j++)await page.locator('[data-step]').click();assert.equal(await reading('Trip progress').textContent(),'80%');assert.equal(await reading('Trip delay').textContent(),'0.10 s remaining');await page.locator('[data-step]').click();assert.equal(await reading('Trip progress').textContent(),'Latched open');}
   if(i===6){assert.equal(await page.locator('[data-play]').isDisabled(),true);await page.locator('[data-step]').click();assert.equal(await reading('Observed time').textContent(),'0.50 / 3 s');await page.getByRole('button',{name:'Reset protective contact',exact:true}).click();assert.equal(await page.locator('[data-play]').isDisabled(),false);assert.equal(await reading('Observed time').textContent(),'0.00 / 3 s');assert.equal(await reading('Trip delay').textContent(),'0.50 s remaining');}
   await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('3.00 / 3 s')&&document.querySelector('[data-play]').getAttribute('aria-pressed')==='false');assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');
   const tripped=[1,5,6,7].includes(i),expected=tripped?'Protection opened · lamp off':i===2?'Case energized · no fault-return path':[3,8].includes(i)?'Case energized · current too low to trip':'Lamp lit · no protective-earth current';assert.equal(await reading('Your result').textContent(),expected);assert.equal(await reading('Trip delay').textContent(),tripped?'Contact already open':'No trip at this setting');
   if(i===4)assert.equal(await reading('Case voltage').textContent(),'Floating · not determined');if(tripped)assert.equal(await reading('Supply current').textContent(),'0.000 A');
   await picture(`preset-${width}-${i}`);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));cases.push({width,title:experiment.title,result:expected,caseVoltage:await reading('Case voltage').textContent()});
  }
  await setup(6);await page.getByRole('button',{name:'Reset protective contact',exact:true}).click();await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('3.00 / 3 s')&&document.querySelector('[data-play]').getAttribute('aria-pressed')==='false');const preparedReplay=await page.locator('[data-play]').evaluate(button=>{button.click();return document.querySelector('.daily-readings').textContent;});assert.match(preparedReplay,/awaiting disconnection/);assert.match(preparedReplay,/0.00 \/ 3 s/);assert.equal(await page.locator('[data-play]').isDisabled(),false);await page.locator('[data-play]').click();
  await setup(1);for(let j=0;j<3;j++)await page.locator('[data-step]').click();await page.getByRole('button',{name:'Restart observation',exact:true}).click();assert.equal(await reading('Observed time').textContent(),'0.00 / 3 s');assert.equal(await reading('Trip progress').textContent(),'60%');await page.locator('[data-control="fault"]').selectOption('0');assert.equal(await reading('Trip progress').textContent(),'0%');await page.locator('[data-control="fault"]').selectOption('1');for(let j=0;j<2;j++)await page.locator('[data-step]').click();assert.equal(await reading('Trip progress').textContent(),'40%');
  await setup(0);await page.locator('[data-play]').click();await page.waitForTimeout(250);await page.locator('[data-play]').click();const paused=await reading('Observed time').textContent();await page.waitForTimeout(200);assert.equal(await reading('Observed time').textContent(),paused);await page.locator('[data-reset-controls]').click();assert.equal(await reading('Observed time').textContent(),'0.00 / 3 s');
  await setup(1);await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('3.00 / 3 s')&&document.querySelector('[data-play]').getAttribute('aria-pressed')==='false');const replay=await page.locator('[data-play]').evaluate(button=>{button.click();return document.querySelector('.daily-readings').textContent;});assert.match(replay,/awaiting disconnection/);assert.match(replay,/0.00 \/ 3 s/);await page.locator('[data-play]').click();
  await page.locator('[data-result]').click();assert.equal(await page.locator('.daily-part-detail h3').textContent(),'A separate path for fault current');await page.locator('.daily-heading h1').click();assert.equal(await page.locator('.daily-part-detail h3').count(),0);await page.locator('[data-view="reset"]').click();await page.locator('[data-separation]').fill('100');assert.equal(await page.locator('.daily-inventory-labels [data-category]').count(),8);for(const view of ['in','out']){await page.locator(`[data-view="${view}"]`).click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');}await picture(`separated-${width}`);await page.locator('[data-reassemble]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'0');
 }
 assert.deepEqual(errors,[]);console.log('PASS earth browser: eighteen preset/viewport cases, seeded fault histories, blocked reset/retrip, physical interruption, precise restart, playback/pause/reset/replay, selection dismissal and separated zoom.');
}catch(error){console.error(error);await page?.screenshot({path:out+'/failure.png',fullPage:true,timeout:5000}).catch(()=>{});throw error;}
finally{await writeFile(out+'/browser.json',JSON.stringify({base,browser:browser.version(),cases,errors},null,2)+'\n');await browser.close();}

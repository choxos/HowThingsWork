import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {createCylinderModel} from './cylinder-model.js';
import {dailyLifeLessons} from './daily-life-lessons.js';
import {mkdir,writeFile} from 'node:fs/promises';
for(const editableKey of [false,true]){
 const lock=createCylinderModel({editableKey});
 lock.update({insertion:.5,turn:70});
 assert.equal(lock.getState().values.turn,0,'a blocked turn request is discarded');
 for(const insertion of [.99,1]){
  lock.update({insertion});assert.equal(lock.getState().turn,0,'seating cannot revive a rejected turn');
 }
 lock.update({turn:70});assert.equal(lock.getState().turn,70,'a fresh turn works once seated');
 lock.reset();lock.update({insertion:.99,turn:70});assert.equal(lock.getState().turn,0,'the key must finish seating before turning');
 lock.dispose();
}
const m=createCylinderModel();
assert.equal(m.getState().unlocked,false);m.update({door:65,turn:80});assert.equal(m.getState().doorAngle,0);assert.equal(m.getState().turn,0);
for(const keyPattern of [1,2]){m.reset();m.update({keyPattern});m.advance(6);assert.equal(m.getState().blocked,true);assert.equal(m.getState().turn,0);assert.equal(m.getState().doorAngle,0);assert.equal(m.getState().boltTravel,0);}
for(const hz of [30,60,144]){m.reset();for(let i=0;i<hz*6;i++)m.advance(1/hz);assert.equal(m.getState().complete,true);assert.equal(m.getState().turn,80);assert.equal(m.getState().values.insertion,1);}
for(const hz of [30,60,144]){m.reset();m.advance(6);m.update({operation:1});for(let i=0;i<hz*6;i++)m.advance(1/hz);assert.equal(m.getState().complete,true);assert.equal(m.getState().doorAngle,0);assert.equal(m.getState().turn,0);assert.equal(m.getState().values.insertion,0);}
m.reset();m.advance(6);m.update({operation:1});m.advance(.5);assert.ok(m.getState().doorAngle>0&&m.getState().doorAngle<65);assert.equal(m.getState().turn,80);m.advance(1.5);assert.equal(m.getState().doorAngle,0);assert.ok(m.getState().turn>0&&m.getState().turn<80);assert.equal(m.getState().values.insertion,1);m.advance(6);assert.equal(m.getState().complete,true);
m.reset();m.advance(6);m.update({turn:0});m.update({insertion:0});m.update({operation:1,keyPattern:1});m.advance(12);assert.equal(m.getState().blocked,true);assert.equal(m.getState().doorAngle,65);m.update({insertion:0});m.update({keyPattern:0});m.advance(12);assert.equal(m.getState().complete,true);
m.reset();m.update({insertion:.98,turn:60});m.update({operation:1});m.advance(6);assert.equal(m.getState().complete,true);
m.reset();m.advance(6);
m.update({insertion:0,keyPattern:1});assert.equal(m.getState().values.insertion,1);assert.equal(m.getState().values.keyPattern,0);
m.update({turn:0});m.update({door:0});assert.equal(m.getState().doorAngle,65);m.update({turn:80});m.update({door:0});assert.equal(m.getState().doorAngle,0);m.update({turn:0});m.update({insertion:0});assert.equal(m.getState().unlocked,false);
m.reset();m.update({insertion:.5,turn:80});assert.equal(m.getState().turn,0);m.update({turn:0});m.advance(.5);assert.equal(m.getState().values.insertion,.75);
m.reset();m.update({insertion:1});
const object=id=>m.parts.find(p=>p.id===id).object,cam=object('cam'),bolt=object('bolt'),frame=object('frame'),driver=object('driver-pin-1');
function assertCoil(mesh){const {path,radius}=mesh.geometry.parameters,first=path.points[0],next=path.points.find((p,i)=>i>0&&Math.abs(p.x-first.x)<1e-8&&Math.abs(p.z-first.z)<1e-8);assert.ok(next.y-first.y>2*radius,'adjacent coil turns retain wire clearance');assert.equal(mesh.scale.y,1,'wire cross-section is not flattened to compress the spring');}
for(const keyPattern of [0,1,2]){
 m.reset();m.update({keyPattern});
 for(let percent=0;percent<=100;percent++){
  m.update({insertion:percent/100});m.root.updateMatrixWorld(true);
  const shearY=object('shear-line').children[0].getWorldPosition(new THREE.Vector3()).y;
  const lower=m.parts.filter(p=>p.id.startsWith('key-pin-')).map(p=>new THREE.Box3().setFromObject(p.object));
  const upper=m.parts.filter(p=>p.id.startsWith('driver-pin-')).map(p=>new THREE.Box3().setFromObject(p.object));
  for(const pin of m.parts.filter(p=>p.id.startsWith('pin-spring-')))assertCoil(pin.object.children[0]);
  const crosses=box=>box.min.y<shearY-1e-7&&box.max.y>shearY+1e-7;
  assert.equal(m.getState().unlocked,![...lower,...upper].some(crosses),'permission agrees with actual solid pins crossing the shear line');
  if(percent===0){assert.ok(upper.every(crosses),'every driver bridges plug and shell with the key removed');const floorY=new THREE.Box3().setFromObject(object('keyway-floor')).max.y;assert.ok(lower.every(box=>Math.abs(box.min.y-floorY)<1e-6),'pin tips rest on the visible keyway floor');}
 }
}
m.reset();m.update({insertion:1});
const origin=new THREE.Vector3(),beforeFrame=frame.getWorldPosition(new THREE.Vector3());
m.root.updateMatrixWorld(true);
const lowerPins=m.parts.filter(p=>p.id.startsWith('key-pin-')).map(p=>({mesh:p.object.children[0],initial:object('lock').worldToLocal(p.object.children[0].getWorldPosition(new THREE.Vector3()))}));
for(let turn=0;turn<=80;turn++){
 m.update({turn});m.root.updateMatrixWorld(true);
 const roller=cam.localToWorld(new THREE.Vector3(0,.34,-.04)),slot=bolt.localToWorld(new THREE.Vector3(0,0,-1.14));
 assert.ok(Math.abs(roller.x-slot.x)<1e-10,'roller stays centered horizontally in the follower slot');
 assert.ok(Math.abs(driver.position.y-.4)<1e-10,'driver remains outside rotating plug');
 for(const {mesh,initial} of lowerPins){
  const expected=initial.clone().applyAxisAngle(new THREE.Vector3(0,0,1),turn*Math.PI/180);
  const actual=object('lock').worldToLocal(mesh.getWorldPosition(new THREE.Vector3()));
  assert.ok(actual.distanceTo(expected)<1e-10,'lower pin follows the plug about its cylinder axis');
 }
 const edge=Math.min(...frame.children.filter(mesh=>mesh.geometry?.parameters.width===.35).map(mesh=>new THREE.Box3().setFromObject(mesh).min.x)),tip=Math.max(...bolt.children.filter(mesh=>mesh.geometry?.parameters.width===.48).map(mesh=>new THREE.Box3().setFromObject(mesh).max.x)),gap=edge-tip,state=m.getState(),clearance=state.readings.find(row=>row.label==='Strike clearance').value;assert.ok(Math.abs(gap-(state.boltTravel-.205))<1e-7,'reading matches actual near-strike and latch-tip meshes');assert.equal(state.boltClear,gap>.025);assert.ok(Math.abs(parseFloat(clearance)-Math.abs(gap))<.000501);assert.ok(clearance.endsWith(gap<0?'overlap':'clear'));assert.equal(state.readings.length,8);assert.ok(state.readings.every(row=>row.hint));
 assert.ok(m.getState().boltTravel<=.34);assertCoil(object('return-spring').children[0]);
 assert.ok(roller.y>cam.getWorldPosition(new THREE.Vector3()).y,'spring force on follower retains a return moment arm');
}
m.update({door:65});m.root.updateMatrixWorld(true);assert.ok(frame.getWorldPosition(origin).distanceTo(beforeFrame)<1e-10);assert.ok(Math.abs(object('door').rotation.y)>1);m.reset();assert.equal(m.getState().doorAngle,0);m.dispose();
const lesson=dailyLifeLessons['Cylinder lock'],probe=createCylinderModel();
for(const [index,preset] of lesson.tryIt.entries()){
 probe.reset();probe.update(preset.values);assert.deepEqual(probe.getState().values,{...preset.values,turn:index===2?0:preset.values.turn});
 if(index===2){probe.update({insertion:.99});assert.equal(probe.getState().turn,0);assert.match(probe.getState().readings.find(row=>row.label==='Key insertion').value,/finish seating/);assert.match(probe.getState().readings.find(row=>row.label==='Next action').value,/Finish inserting/);probe.update({insertion:1});assert.equal(probe.getState().turn,0);probe.update({turn:30});assert.equal(probe.getState().turn,30);}
 if(index===5){probe.update({door:65});assert.equal(probe.getState().doorAngle,0);probe.update({turn:43});const gap=probe.getState().readings.find(row=>row.label==='Strike clearance').value;probe.update({door:65});assert.equal(probe.getState().doorAngle,65);assert.equal(probe.getState().readings.find(row=>row.label==='Strike clearance').value,gap);}
 probe.advance(7);const wrong=[1,4].includes(index);assert.equal(probe.getState().blocked,wrong);
 if(wrong){assert.equal(probe.getState().pinOffsets.filter(x=>Math.abs(x)>1e-6).length,index===1?1:5);probe.update({insertion:0});probe.update({keyPattern:0});probe.advance(7);}
 assert.equal(probe.getState().complete,true);assert.equal(probe.getState().doorAngle,index===3?0:65);
}
probe.dispose();console.log('PASS cylinder model: 303 physical pin-profile poses, 81 cam/coil/near-strike poses, three frame rates both ways, 42/43 opening boundary, discarded blocked turns and six complete presets/recoveries.');
if(process.env.MODEL_ONLY==='1')process.exit(0);
const evidence=process.env.EVIDENCE_DIR||'/tmp/howthingswork-cylinder';await mkdir(evidence,{recursive:true});const cases=[];
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/cylinder-lock`);await page.getByRole('button',{name:'Run selected action',exact:true}).waitFor();
 await page.getByRole('spinbutton',{name:'Open the door value',exact:true}).fill('65');assert.match(await page.locator('.daily-readings').textContent(),/Door held closed/);
 await page.getByRole('combobox',{name:'Key pattern',exact:true}).selectOption('1');await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-number="insertion"]').value==='1');assert.match(await page.locator('.daily-readings').textContent(),/1 of 5 joints away/);assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');await page.screenshot({path:'/tmp/howthingswork-cylinder-wrong-key.png',fullPage:true});
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-number="door"]').value==='65');assert.match(await page.locator('.daily-readings').textContent(),/Door open · passage clear/);assert.equal(await page.getByRole('spinbutton',{name:'Key insertion value',exact:true}).isDisabled(),true);await page.screenshot({path:'/tmp/howthingswork-cylinder-open.png',fullPage:true});
 await page.getByRole('spinbutton',{name:'Open the door value',exact:true}).fill('0');await page.getByRole('spinbutton',{name:'Attempt to turn value',exact:true}).fill('0');await page.getByRole('spinbutton',{name:'Key insertion value',exact:true}).fill('0');assert.match(await page.locator('.daily-readings').textContent(),/Door held closed/);
 await page.getByRole('button',{name:'Back',exact:true}).click();await page.screenshot({path:'/tmp/howthingswork-cylinder-cam.png',fullPage:true});
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(3).click();assert.match(await page.locator('.daily-readings').textContent(),/Door open/);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await page.goto('about:blank');await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/cylinder-lock`);await page.locator('[data-play]').waitFor();
  const capture=async name=>{await page.locator('canvas').evaluate(c=>{scrollTo({top:0,behavior:'instant'});c.scrollIntoView({block:'center',behavior:'instant'})});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));return page.screenshot({path:`${evidence}/${name}-${width}.png`,clip:await page.locator('canvas').boundingBox()});};await capture('opening');
  for(const [index,preset] of lesson.tryIt.entries()){
   await page.locator('[data-cutaway]').uncheck();await page.locator('[data-isolate]').check();await page.locator('[data-view="top"]').click();await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(index).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
   const expected={...preset.values,turn:index===2?0:preset.values.turn},wrong=[1,4].includes(index);for(const [key,value] of Object.entries(expected))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));assert.equal(await page.locator('[data-cutaway]').isChecked(),true);assert.equal(await page.locator('[data-isolate]').isChecked(),false);assert.equal(await page.locator('.daily-readings dt').count(),8);
   const initial=await capture('initial-'+index);await page.locator(`[data-view="${preset.view}"]`).click();assert.ok(initial.equals(await capture('view-check-'+index)),'preset restores its named view');
   if(index===2){await page.locator('[data-number="insertion"]').fill('.99');assert.equal(await page.locator('[data-number="turn"]').inputValue(),'0');assert.match(await page.locator('.daily-readings').textContent(),/finish seating/);await page.locator('[data-number="insertion"]').fill('1');assert.equal(await page.locator('[data-number="turn"]').inputValue(),'0');await page.locator('[data-number="turn"]').fill('30');assert.equal(await page.locator('[data-number="turn"]').inputValue(),'30');await capture('fresh-turn');}
   if(index===5){await page.locator('[data-number="door"]').fill('65');await page.locator('[data-number="door"]').blur();assert.equal(await page.locator('[data-number="door"]').inputValue(),'0');await page.locator('[data-number="turn"]').fill('43');await page.locator('[data-number="door"]').fill('10');assert.equal(await page.locator('[data-number="door"]').inputValue(),'10');await capture('first-clear');}
   const before=await page.locator('.daily-readings').textContent();await page.locator('[data-step]').click();assert.notEqual(await page.locator('.daily-readings').textContent(),before);await page.locator('[data-play]').click();await page.waitForTimeout(180);await page.getByRole('button',{name:'Pause',exact:true}).click();const paused=await page.locator('.daily-readings').textContent();await page.waitForTimeout(120);assert.equal(await page.locator('.daily-readings').textContent(),paused);await page.locator('[data-play]').click();
   if(wrong){await page.waitForFunction(()=>document.querySelector('[data-play]').disabled);assert.equal(await page.locator('[data-number="turn"]').inputValue(),'0');assert.equal(await page.locator('[data-number="door"]').inputValue(),'0');assert.match(await page.locator('.daily-readings').textContent(),index===1?/1 of 5 joints away/:/5 of 5 joints away/);await capture('blocked-'+index);await page.locator('[data-number="insertion"]').fill('0');await page.locator('[data-control="keyPattern"]').selectOption('0');await page.locator('[data-play]').click();}
   await page.locator('[data-play][title^="Play again"]').waitFor({timeout:30000});assert.equal(await page.locator('[data-number="door"]').inputValue(),index===3?'0':'65');assert.equal(await page.locator('[data-number="insertion"]').inputValue(),index===3?'0':'1');assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Door and cylinder lock');await capture(wrong?'recovered-'+index:'complete-'+index);await page.locator('[data-result]').click();
   await page.locator('[data-play]').evaluate(b=>{b.click();b.click()});const replay={...expected,...(wrong?{keyPattern:0}:{}),...(index===2?{insertion:1,turn:30}:{}),...(index===5?{turn:43,door:10}:{})};for(const [key,value] of Object.entries(replay))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value),'replay '+key);await capture('replay-'+index);cases.push({width,preset:index,wrongRecovered:wrong,replay:true});
  }
  await page.locator('[data-reset-controls]').click();await page.locator('[data-view="reset"]').click();await page.locator('[data-separation]').fill('100');await page.getByText('Fully separated',{exact:true}).waitFor();assert.equal(await page.locator('.daily-inventory-labels [data-category]:visible').count(),7);await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await capture('separated');await page.locator('[data-reassemble]').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 assert.equal(cases.length,12);assert.deepEqual(errors,[]);await writeFile(`${evidence}/browser.json`,JSON.stringify({cases,errors},null,2));
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);console.log('PASS cylinder lock: wrong-key block, frame-rate-independent opening, captured key, manual relock, cam/slot contact, fixed frame, live presets and mobile.');
}finally{await browser.close();}

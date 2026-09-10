import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import * as THREE from 'three';
import {createBellModel} from './bell-model.js';

for(const condition of [0,1,2]){
 const model=createBellModel();model.update({contact:condition,holdTime:.8});
 let openings=0,closings=0,previous=model.getState(),decayed=false,bypassHeld=false;
 const mesh=id=>model.parts.find(part=>part.id===id).object.children.find(child=>child.geometry?.type==='RoundedBoxGeometry');
 for(let i=0;i<400&&!model.getState().complete;i++){
  model.advance(.02);const state=model.getState();model.root.updateMatrixWorld(true);
  const fixed=new THREE.Box3().setFromObject(mesh('fixed-contact')),moving=new THREE.Box3().setFromObject(mesh('moving-contact'));
  assert.ok(Math.abs(moving.min.x-fixed.max.x-state.contactGap)<1e-7,'actual faces agree with contact reading');
  if(previous.contactClosed&&!state.contactClosed)openings++;
  if(!previous.contactClosed&&state.contactClosed)closings++;
  if(state.pressed&&!state.contactClosed&&previous.current>state.current+.01)decayed=true;
  if(state.pressed&&!state.contactClosed&&state.current>.29&&state.strikes===1)bypassHeld=true;
  if(condition===1)assert.equal(state.current,0,'held-open contact admits no current');
  previous=state;
 }
 if(condition===0)assert.ok(openings>=3&&closings>=3&&decayed,'normal contact repeatedly opens, loses current and recloses');
 if(condition===2)assert.ok(bypassHeld,'open contact with bypass still carries holding current');
 model.dispose();
}
console.log('PASS actual contact gaps, repeated opening/reclosing with current decay, open-circuit zero current and bypass holding current.');

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/electromagnetic-make-and-break-contacts`);
 await page.getByRole('heading',{name:'Electromagnetic make-and-break contacts',exact:true}).waitFor();
 const isolated=page.getByRole('checkbox',{name:'Isolate selected part',exact:true}),detail=page.locator('.daily-part-detail');
 assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Make-and-break contacts/);
 for(const [index,outcome] of [[0,'3 strikes · the bell rang repeatedly'],[1,'No strikes · the bell stayed quiet'],[2,'One strike · no repeated ringing']]){
  await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();
  await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(index).click();
  await page.getByRole('tab',{name:'Controls',exact:true}).click();
  assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Make-and-break contacts/);
  await page.getByRole('button',{name:'Advance one step',exact:true}).click();
  assert.match(await page.locator('.daily-readings').textContent(),/Button held/);
  await page.getByRole('button',{name:'Ring the bell',exact:true}).click();
  await page.waitForFunction(text=>document.querySelector('.daily-readings')?.textContent.includes(text)&&document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',outcome);
  assert.match(await detail.textContent(),/Connected electric bell/);
 }
 await isolated.check();await page.getByRole('button',{name:'Reset experiment',exact:true}).click();
 assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Make-and-break contacts/);
 await page.getByRole('button',{name:'It keeps coil current flowing around the open contact.',exact:true}).click();
 assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);
 await page.screenshot({path:'/tmp/howthingswork-bell-contacts-lesson.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);
 console.log('PASS make-and-break contact browser: dedicated connected route, three stepped experiments and whole-bell outcomes, reset context, quiz and mobile.');
}finally{await browser.close();}

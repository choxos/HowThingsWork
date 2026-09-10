import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBellModel} from './bell-model.js';
import {chromium} from 'playwright';

for(const [values,expected] of [[{holdTime:.2},2],[{holdTime:.8},9],[{holdTime:.35,contact:1},0]]){
 const m=createBellModel();m.update(values);const get=id=>m.parts.find(part=>part.id===id).object;
 let sawPress=false,sawOpen=false,sawClosed=false;
 for(let step=0;step<2000&&!m.playback.complete();step++){
  const state=m.getState();m.root.updateMatrixWorld(true);
  const bridge=new THREE.Box3().setFromObject(get('plunger').children.find(o=>o.geometry?.type==='RoundedBoxGeometry'));
  const terminals=get('button').children.filter(o=>o.geometry?.type==='RoundedBoxGeometry');assert.equal(terminals.length,2);
  for(const terminal of terminals){const bounds=new THREE.Box3().setFromObject(terminal);
   assert.ok(Math.abs(bridge.min.z-bounds.max.z-(state.pressed?0:.0675))<1e-8,'actual bridge gap agrees with button state');
   assert.ok(bridge.min.x<bounds.max.x&&bridge.max.x>bounds.min.x&&bridge.min.y<bounds.max.y&&bridge.max.y>bounds.min.y,'bridge overlaps both conducting terminals');
  }
  const spring=get('button-spring').children.find(o=>o.geometry?.type==='TubeGeometry'),path=spring.geometry.parameters.path;
  assert.ok(Math.abs(spring.localToWorld(path.getPoint(1)).z-bridge.min.z)<1e-8,'spring stays connected to bridge');
  if(state.pressed){sawPress=true;sawOpen ||= !state.contactClosed;sawClosed ||= state.contactClosed;}
  m.playback.advance(.017);
 }
 assert.equal(m.getState().complete,true);assert.equal(m.getState().pressed,false);assert.equal(m.getState().strikes,expected);assert.ok(sawPress);
 if(expected)assert.ok(sawOpen&&sawClosed,'internal switch cycles while button stays pressed');
 m.dispose();
}
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/electric-bell-pushbutton-switch`);
 await page.getByRole('heading',{name:'Electric-bell pushbutton switch',exact:true}).waitFor();
 const isolated=page.getByRole('checkbox',{name:'Isolate selected part',exact:true}),detail=page.locator('.daily-part-detail');
 assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Door button/);
 for(const [index,outcome] of [[0,'2 strikes · the bell rang repeatedly'],[1,'9 strikes · the bell rang repeatedly'],[2,'No strikes · the bell stayed quiet']]){
  await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();
  await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(index).click();
  await page.getByRole('tab',{name:'Controls',exact:true}).click();
  assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Door button/);
  await page.getByRole('button',{name:'Advance one step',exact:true}).click();
  assert.match(await page.locator('.daily-readings').textContent(),/Button held/);
  await page.getByRole('button',{name:'Ring the bell',exact:true}).click();
  await page.waitForFunction(text=>document.querySelector('.daily-readings')?.textContent.includes(text)&&document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',outcome);
  assert.match(await detail.textContent(),/Connected electric bell/);
 }
 await isolated.check();await page.getByRole('button',{name:'Reset experiment',exact:true}).click();
 assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Door button/);
 await page.getByRole('button',{name:'The separate internal contact cycles while the button stays closed.',exact:true}).click();
 assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);
 await page.screenshot({path:'/tmp/howthingswork-bell-button-lesson.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);
 console.log('PASS bell button geometry and browser: dedicated connected route, three stepped experiments and whole-bell outcomes, reset context, quiz and mobile.');
}finally{await browser.close();}

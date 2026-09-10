import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {createCylinderModel} from './cylinder-model.js';
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
 assert.ok(m.getState().boltTravel<=.34);assertCoil(object('return-spring').children[0]);
 assert.ok(roller.y>cam.getWorldPosition(new THREE.Vector3()).y,'spring force on follower retains a return moment arm');
}
m.update({door:65});m.root.updateMatrixWorld(true);assert.ok(frame.getWorldPosition(origin).distanceTo(beforeFrame)<1e-10);assert.ok(Math.abs(object('door').rotation.y)>1);m.reset();assert.equal(m.getState().doorAngle,0);m.dispose();
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/cylinder-lock`);await page.getByRole('button',{name:'Run selected action',exact:true}).waitFor();
 await page.getByRole('spinbutton',{name:'Open the door value',exact:true}).fill('65');assert.match(await page.locator('.daily-readings').textContent(),/Door held closed/);
 await page.getByRole('combobox',{name:'Key pattern',exact:true}).selectOption('1');await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-number="insertion"]').value==='1');assert.match(await page.locator('.daily-readings').textContent(),/1 of 5 joints away/);assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');await page.screenshot({path:'/tmp/howthingswork-cylinder-wrong-key.png',fullPage:true});
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-number="door"]').value==='65');assert.match(await page.locator('.daily-readings').textContent(),/Door open · passage clear/);assert.equal(await page.getByRole('spinbutton',{name:'Key insertion value',exact:true}).isDisabled(),true);await page.screenshot({path:'/tmp/howthingswork-cylinder-open.png',fullPage:true});
 await page.getByRole('spinbutton',{name:'Open the door value',exact:true}).fill('0');await page.getByRole('spinbutton',{name:'Attempt to turn value',exact:true}).fill('0');await page.getByRole('spinbutton',{name:'Key insertion value',exact:true}).fill('0');assert.match(await page.locator('.daily-readings').textContent(),/Door held closed/);
 await page.getByRole('button',{name:'Back',exact:true}).click();await page.screenshot({path:'/tmp/howthingswork-cylinder-cam.png',fullPage:true});
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(3).click();assert.match(await page.locator('.daily-readings').textContent(),/Door open/);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);console.log('PASS cylinder lock: wrong-key block, frame-rate-independent opening, captured key, manual relock, cam/slot contact, fixed frame, live presets and mobile.');
}finally{await browser.close();}

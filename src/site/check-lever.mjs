import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {createLeverModel} from './lever-model.js';

const m=createLeverModel(),object=id=>m.parts.find(p=>p.id===id).object;
for(const hz of [30,60,144]){
 m.reset();for(let i=0;i<12*hz;i++)m.advance(1/hz);assert.equal(m.getState().complete,true);assert.equal(m.getState().doorAngle,65);assert.equal(m.getState().values.insertion,0);
 m.update({operation:1});for(let i=0;i<12*hz;i++)m.advance(1/hz);assert.equal(m.getState().complete,true);assert.equal(m.getState().boltTravel,0);assert.equal(m.getState().values.insertion,0);
}
for(const keyPattern of [1,2]){m.reset();m.update({keyPattern});m.advance(12);assert.equal(m.getState().blocked,true);assert.equal(m.getState().boltTravel,0);assert.equal(m.getState().doorAngle,0);assert.ok(m.getState().leverAngles.every(a=>a>=0));}
m.reset();m.update({door:65,turn:360});assert.equal(m.getState().doorAngle,0);assert.equal(m.getState().turn,0);m.update({insertion:.8,turn:360});assert.equal(m.getState().turn,0);
m.reset();m.update({insertion:1,turn:135});assert.equal(m.getState().gatesClear,true);assert.equal(m.getState().boltTravel,0);m.update({insertion:0,keyPattern:1});assert.equal(m.getState().values.insertion,1);assert.equal(m.getState().values.keyPattern,0);
m.update({turn:270});assert.equal(m.getState().boltTravel,.6);assert.ok(m.getState().leverAngles.every(a=>a>0));m.update({turn:360});assert.deepEqual(m.getState().leverAngles,[0,0,0]);assert.equal(m.getState().boltTravel,.6);m.update({insertion:0});assert.equal(m.getState().values.insertion,0);
m.update({door:65,operation:1,keyPattern:1});m.advance(12);assert.equal(m.getState().blocked,true);assert.equal(m.getState().boltTravel,.6);assert.equal(m.getState().doorAngle,0);
m.update({turn:360});m.update({insertion:0});m.update({keyPattern:0});m.advance(12);assert.equal(m.getState().complete,true);
m.reset();m.advance(12);m.update({insertion:1});m.update({turn:0});m.update({insertion:0});assert.equal(m.getState().doorAngle,65);assert.equal(m.getState().boltTravel,0);m.update({operation:1});m.advance(20);assert.equal(m.getState().complete,true);assert.equal(m.getState().doorAngle,0);
function inside(p,polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;}return hit;}
for(const keyPattern of [0,1,2]){
 m.reset();m.update({keyPattern});m.update({insertion:1});
 for(let turn=0;turn<=360;turn++){
  m.update({turn});m.root.updateMatrixWorld(true);const state=m.getState(),lock=object('lock'),stump=object('stump').getWorldPosition(new THREE.Vector3());lock.worldToLocal(stump);assert.ok(Math.abs(stump.x-(.45-state.boltTravel))<1e-7&&Math.abs(stump.y-.9)<1e-7,'named stump moves with the tested bolt peg');
  for(let i=1;i<=3;i++){
   const lever=object('tumbler-'+i),solid=lever.children.find(o=>o.isMesh&&o.geometry.type==='ExtrudeGeometry'),hole=solid.geometry.parameters.shapes.holes[0].getPoints();
   for(let n=0;n<32;n++){const a=n*Math.PI/16,p=lock.localToWorld(new THREE.Vector3(.45-state.boltTravel+.035*Math.cos(a),.9+.035*Math.sin(a),0));lever.worldToLocal(p);assert.ok(inside(p,hole),'stump stays in actual lever opening at '+keyPattern+'/'+turn+'/'+i);}
   const marker=object('bolt-path-'+i).children[1].getWorldPosition(new THREE.Vector3());lock.worldToLocal(marker);assert.ok(Math.abs(marker.x-(.45-state.boltTravel))<1e-7&&Math.abs(marker.y-.9)<1e-7,'isolated path reference remains at actual stump position');
   const cam=object('key-shoulder-'+i).children[0],vertices=cam.geometry.attributes.position;let top=-Infinity;
   for(let n=0;n<vertices.count;n++){const p=cam.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices,n));lever.worldToLocal(p);top=Math.max(top,p.y);}
   assert.ok(top<=-.32+1e-6,'key never passes through the lever land');if(state.leverAngles[i-1]>0)assert.ok(-.32-top<.0002,'raised lever retains actual key contact');
   const spring=object('spring-'+i).children[0].geometry.parameters.path.points;assert.deepEqual(spring[0].toArray(),[-.9,1.25,-.08+(i-1)*.2+.03]);
   const tip=lever.localToWorld(new THREE.Vector3(.95,.34,.03));lock.worldToLocal(tip);assert.ok(tip.distanceTo(spring.at(-1))<1e-7,'spring bears on its attached lever');
   const curve=object('spring-'+i).children[0].geometry.parameters.path;for(const brace of object('bolt-bracket').children){const h=brace.geometry.parameters.height/2,a=lock.worldToLocal(brace.localToWorld(new THREE.Vector3(0,-h,0))),b=lock.worldToLocal(brace.localToWorld(new THREE.Vector3(0,h,0))),segment=new THREE.Line3(a,b);for(const point of curve.getPoints(64))assert.ok(segment.closestPointToPoint(point,true,new THREE.Vector3()).distanceTo(point)>.047,'moving bracket clears actual spring wire');}
  }
  const roller=object('key-drive').children[1].getWorldPosition(new THREE.Vector3());lock.worldToLocal(roller);
  if(roller.y>=0){const left=-state.boltTravel,right=.6-state.boltTravel;assert.ok(roller.x>=left-1e-7&&roller.x<=right+1e-7,'drive roller stays inside actual slot');}
 }
}
m.reset();m.root.updateMatrixWorld(true);const fixed=object('frame').matrixWorld.clone();m.advance(12);m.root.updateMatrixWorld(true);assert.ok(object('frame').matrixWorld.equals(fixed));assert.notEqual(object('door').rotation.y,0);m.dispose();

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/lever-lock`);await page.getByRole('button',{name:'Run selected action',exact:true}).waitFor();
 await page.getByRole('combobox',{name:'Key pattern',exact:true}).selectOption('1');await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-number="turn"]').value==='180');assert.match(await page.locator('.daily-readings').textContent(),/Door held closed/);await page.screenshot({path:'/tmp/howthingswork-lever-wrong-key.png',fullPage:true});
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-number="door"]').value==='65');assert.equal(await page.getByRole('spinbutton',{name:'Key insertion value',exact:true}).inputValue(),'0');assert.match(await page.locator('.daily-readings').textContent(),/Door open · passage clear/);await page.screenshot({path:'/tmp/howthingswork-lever-open.png',fullPage:true});
 await page.getByRole('combobox',{name:'Run action',exact:true}).selectOption('1');await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Door secured · key removed'));await page.screenshot({path:'/tmp/howthingswork-lever-secured.png',fullPage:true});
 for(const [i,turn,pattern] of [[3,0,0],[0,0,1],[1,135,0],[2,270,0]]){
  await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
  assert.equal(await page.getByRole('spinbutton',{name:'Turn the key value',exact:true}).inputValue(),String(turn));assert.equal(await page.getByRole('spinbutton',{name:'Open the door value',exact:true}).inputValue(),'0');assert.equal(await page.getByRole('combobox',{name:'Key pattern',exact:true}).inputValue(),String(pattern));assert.equal(await page.getByRole('combobox',{name:'Run action',exact:true}).inputValue(),'0');
  await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(wrong=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false'&&(wrong?document.querySelector('[data-number="turn"]').value==='180':document.querySelector('[data-number="door"]').value==='65'),i===0);
  assert.match(await page.locator('.daily-readings').textContent(),i===0?/Door held closed/:/Door open · passage clear/);
 }
 await page.getByRole('button',{name:'The stump rests in the other end pockets while the springs lower the levers.',exact:true}).click();assert.match(await page.getByRole('status').textContent(),/That’s right/);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);console.log('PASS lever lock: contact, actual gate openings, spring attachment, wrong-key obstruction, full opening and relocking at three frame rates, browser presets, quiz and mobile.');
}catch(error){console.error(await page.locator('.daily-readings').textContent());throw error;}finally{await browser.close();}

import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {createSocketModel} from './socket-model.js';
import {createPartExplosion} from './part-explosion.js';
import {safetyLessons} from './safety-lessons.js';

const base=process.env.SITE_URL||'http://127.0.0.1:5193/',out=process.env.EVIDENCE_DIR||'documentation/audit/evidence/power-socket-20260919';await mkdir(out,{recursive:true});
const model=createSocketModel(),lesson=safetyLessons['Power socket'];
const near=(a,b,message)=>assert(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${message}: ${a} != ${b}`);
const object=id=>model.parts.find(p=>p.id===id).object;
const reset=values=>{model.reset();model.animate(0);model.update({...model.defaults,...values});};
const endpoints=mesh=>[-1,1].map(sign=>mesh.localToWorld(new THREE.Vector3(0,sign*mesh.geometry.parameters.height/2,0)));
function geometry(){
 const s=model.getState(),v=s.values;model.root.updateMatrixWorld(true);
 for(const [id,length,back] of [['earth',1.1,-1.04],['line',.8,-.72],['neutral',.8,-.72]]){
  const pin=object('pin-'+id),tip=pin.localToWorld(new THREE.Vector3(0,0,-length));near(tip.z,s.position-length,'Pin moves with plug');
  const engaged=tip.z<=-.4;assert.equal(id==='earth'?s.earthContact:s.powerContacts,engaged,'Contact state matches pin tip depth');assert(tip.z>back+.0175,'Pin never bottoms out in contact');
  const pinBounds=new THREE.Box3().setFromObject(pin.children[0]),clipBounds=new THREE.Box3().setFromObject(object('contact-'+id));assert.equal(pinBounds.intersectsBox(clipBounds),engaged,'Actual metal pin overlaps its own clip only after engagement');
 }
 assert(!s.powerContacts||s.earthContact,'Earth engages before power and leaves after it');
 const lowerSpring=object('spring').localToWorld(new THREE.Vector3(.045,0,0)),seat=new THREE.Box3().setFromObject(object('spring-seat'));near(seat.distanceToPoint(lowerSpring),0,'Spring end supported by fixed seat');
 const springMesh=object('spring').children[0],upper=springMesh.localToWorld(new THREE.Vector3(.045,.4,0));near(upper.y,.55-s.travel,'Spring follows moving shutter bar');
 if(s.travel>0){const z=Math.max(-.32,s.position-1.1),rampPoint=object('cam').children[0].localToWorld(new THREE.Vector3(z,1.31-z,.06));near(rampPoint.y,1.35,'Cam presses against underside of earth pin');}
 if(s.position-.8<=-.09)assert(.97-s.travel<.79,'Shutter clears power pins before they reach its plane');
 const bladeTip=object('switch-blade').localToWorld(new THREE.Vector3(.3,0,0)),switchSeat=new THREE.Vector3(-.65,1.65,-.45);if(v.switch)near(bladeTip.distanceTo(switchSeat),0,'Closed switch touches seat');else assert(bladeTip.distanceTo(switchSeat)>.2,'Open switch creates gap');
 for(const [i,start,end] of [[0,.2,1.6],[1,-.2,1.9],[2,0,1.75]]){
  const meshes=object('cable-'+i).children,first=endpoints(meshes[0])[0],last=endpoints(meshes[3])[1];near(first.distanceTo(new THREE.Vector3(start,.35,s.position+.1)),0,'Cable follows plug terminal');near(last.distanceTo(new THREE.Vector3(end,.4,.65)),0,'Cable stays connected to lamp');const y=.08-i*.07,length=meshes.reduce((sum,mesh)=>sum+endpoints(mesh)[0].distanceTo(endpoints(mesh)[1]),0);near(length,Math.hypot(.35-y,.3)+2.8+.4-y,'Conductor length stays constant as its slack fold changes');for(let j=1;j<4;j++)near(endpoints(meshes[j-1])[1].distanceTo(endpoints(meshes[j])[0]),0,'Cable has no gaps');
 }
 for(const id of ['socket-wires','plug-wires'])for(const lead of object(id).children)for(let j=1;j<lead.children.length;j++)near(endpoints(lead.children[j-1])[1].distanceTo(endpoints(lead.children[j])[0]),0,'Continuous internal wire stays joined');
 const bulb=object('lamp').children.find(o=>o.geometry?.type==='SphereGeometry');assert.equal(bulb.material.emissiveIntensity>0,s.powered,'Lamp emission follows complete circuit');
}
let configurations=0;
for(const direction of [-1,1])for(const socketSwitch of [0,1])for(let i=0;i<=100;i++){
 reset({insertion:i/100,switch:socketSwitch,direction});const s=model.getState();near(s.current,s.powerContacts*socketSwitch*12/24,'Current through ideal switched load');assert.equal(s.complete,direction===1?i===100:i===0);geometry();configurations++;
}
reset();model.root.updateMatrixWorld(true);const lampBase=object('lamp').children[0];for(const x of [-.15,.15]){const origin=object('lamp').localToWorld(new THREE.Vector3(x,1,0)),ray=new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0));assert.equal(ray.intersectObject(lampBase).length,0,'Insulated lead passes through a real hole in metal base');}
for(const hz of [15,30,60,144])for(const direction of [-1,1]){
 reset({insertion:direction===1?0:1,direction});for(let t=0;t<1.5-1e-10;t+=1/hz)model.advance(Math.min(1/hz,1.5-t));near(model.getState().values.insertion,.5,'Midpoint independent of frame rate');for(let t=0;t<1.5-1e-10;t+=1/hz)model.advance(Math.min(1/hz,1.5-t));assert.equal(model.getState().values.insertion,direction===1?1:0);assert(model.getState().complete);const complete=model.getState();model.advance(1);assert.deepEqual(model.getState(),complete,'Completed pose remains fixed');
}
reset();model.advance(1.5);model.update({direction:-1});model.advance(.15);near(model.getState().values.insertion,.45,'Reverse from current position');model.update({insertion:.25,direction:1});model.advance(.15);near(model.getState().values.insertion,.3,'Manual setting becomes new starting position');
reset();model.advance(.001);model.actions[0].run();model.advance(1.5);near(model.getState().values.insertion,.5,'Full withdrawal clears sub-step motion remainder');model.update({switch:0});near(model.getState().values.insertion,.5,'Switch changes do not move plug');model.reset();assert.deepEqual(model.getState().values,model.defaults,'Reset refreshes values immediately');
for(const dt of [NaN,Infinity,-1,0])model.advance(dt);assert.equal(model.getState().values.insertion,0);model.update({insertion:NaN,switch:NaN,direction:0});assert.deepEqual(model.getState().values,model.defaults);model.update({insertion:10});assert.equal(model.getState().values.insertion,1);model.update({insertion:-10});assert.equal(model.getState().values.insertion,0);
const presets=[];
for(const [i,experiment] of lesson.tryIt.entries()){
 reset({insertion:.17,switch:0,direction:-1});assert(experiment.reset);assert.deepEqual(Object.keys(experiment.values).sort(),Object.keys(model.defaults).sort());reset(experiment.values);const initial=model.getState();if(i===3){assert.equal(initial.travel,.28);assert.equal(initial.earthContact,false);assert.equal(initial.powerContacts,false);}if(i===4){assert(initial.earthContact);assert(!initial.powerContacts);}if(i===1){model.update({switch:1});assert(model.getState().powered);model.update({switch:0});}
 if(i===2){for(let j=0;j<5;j++)model.playback.step();assert(!model.getState().powerContacts);assert(model.getState().earthContact);}
 model.advance(3);const s=model.getState();assert(s.complete);assert.equal(s.powered,[0,3,4].includes(i));geometry();if(i===5){model.update({switch:1});assert(model.getState().powered);}presets.push({title:experiment.title,initialInsertion:initial.values.insertion,direction:initial.values.direction,finalInsertion:s.values.insertion,powered:s.powered});
}
reset();model.covers.forEach(c=>c.visible=false);assert(object('plug-body').children.every(c=>c.visible));const camera=new THREE.PerspectiveCamera(40,1,.1,100);camera.position.set(5,4,8);camera.lookAt(0,1,0);camera.updateMatrixWorld();const explosion=createPartExplosion(model,camera,1.2);explosion.update(1);assert.equal(explosion.categories.length,6);assert.equal(explosion.items.filter(p=>p.category==='cable').length,3);assert.equal(explosion.items.filter(p=>p.id==='socket-wires').length,4);assert.equal(explosion.items.filter(p=>p.id==='plug-wires').length,4);for(const id of ['earth','line','neutral'])assert(explosion.items.some(p=>p.id==='contact-'+id));assert.equal(new Set(model.parts.map(p=>p.name)).size,model.parts.length);explosion.dispose();model.dispose();
await writeFile(out+'/model.json',JSON.stringify({configurations,presets,result:'PASS'},null,2)+'\n');console.log('PASS socket model: 404 settings, actual pin/clip contacts, cam and spring constraint, continuous cable endpoints, insulated lamp-base holes, both motion directions and frame rates, six presets and six separated categories.');
if(process.env.MODEL_ONLY==='1')process.exit(0);

const browser=await chromium.launch({headless:true}),errors=[],cases=[];let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 const reading=label=>page.locator('.daily-readings > div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd');
 const setup=async i=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();};
 const picture=async name=>{await page.locator('canvas').scrollIntoViewIfNeeded();await page.mouse.move(0,0);await page.screenshot({path:`${out}/${name}.png`,clip:await page.locator('.daily-canvas-wrap').boundingBox()});};
 const finished=async endpoint=>page.waitForFunction(value=>document.querySelector('[data-control="insertion"]').value===String(value)&&document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',endpoint);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await page.goto(base+'#machine/power-socket');await page.locator('[data-play]').waitFor();
  for(const [i,experiment] of lesson.tryIt.entries()){
   console.log(width,experiment.title);await setup(i);for(const [key,value] of Object.entries(experiment.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));await picture(`initial-${width}-${i}`);
   if(i===1){await page.locator('[data-control="switch"]').selectOption('1');assert.equal(await reading('Lamp current').textContent(),'0.50 A');assert.equal(await page.locator('[data-control="insertion"]').inputValue(),'1');await page.locator('[data-control="switch"]').selectOption('0');assert.equal(await reading('Lamp current').textContent(),'0.00 A');}
   if(i===2){for(let j=0;j<5;j++)await page.locator('[data-step]').click();assert.equal(await reading('Earth contact').textContent(),'Engaged');assert.equal(await reading('Line and neutral contacts').textContent(),'Separated');await picture(`withdraw-earth-only-${width}`);}
   if(i===3){assert.equal(await reading('Shutter').textContent(),'Open');assert.equal(await reading('Earth contact').textContent(),'Separated');assert.equal(await reading('Line and neutral contacts').textContent(),'Separated');}
   if(i===4){assert.equal(await reading('Earth contact').textContent(),'Engaged');assert.equal(await reading('Line and neutral contacts').textContent(),'Separated');}
   await page.locator('[data-play]').click();await finished(experiment.values.direction===1?1:0);const powered=[0,3,4].includes(i);assert.equal(await reading('Lamp current').textContent(),powered?'0.50 A':'0.00 A');assert.equal(await reading('Lamp power').textContent(),powered?'6.00 W':'0.00 W');assert.equal(await reading('Protective-earth current').textContent(),'0.00 A');if(experiment.values.direction===-1)assert.equal(await reading('Shutter').textContent(),'Closed');
   if(i===5){assert.equal(await reading('Your result').textContent(),'Plug connected · socket switch off');await page.locator('[data-control="switch"]').selectOption('1');assert.equal(await reading('Lamp power').textContent(),'6.00 W');}
   await picture(`final-${width}-${i}`);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));cases.push({width,title:experiment.title,finalInsertion:await page.locator('[data-control="insertion"]').inputValue(),lampCurrent:await reading('Lamp current').textContent()});
  }
  await setup(2);await page.locator('[data-play]').click();await finished(0);const reverseReplay=await page.locator('[data-play]').evaluate(button=>{button.click();return document.querySelector('[data-control="insertion"]').value;});assert.equal(reverseReplay,'1');assert.equal(await page.locator('[data-control="direction"]').inputValue(),'-1');await page.locator('[data-play]').click();
  await setup(0);await page.locator('[data-play]').click();await page.waitForTimeout(400);await page.locator('[data-play]').click();const paused=await page.locator('[data-control="insertion"]').inputValue();await page.waitForTimeout(200);assert.equal(await page.locator('[data-control="insertion"]').inputValue(),paused);await page.locator('[data-control="switch"]').selectOption('0');assert.equal(await page.locator('[data-control="insertion"]').inputValue(),paused);await page.locator('[data-reset-controls]').click();assert.equal(await page.locator('[data-control="insertion"]').inputValue(),'0');assert.equal(await page.locator('[data-control="direction"]').inputValue(),'1');
  await page.locator('[data-control="insertion"]').fill('0.5');await page.locator('[data-control="direction"]').selectOption('-1');await page.locator('[data-step]').click();assert.equal(await page.locator('[data-control="insertion"]').inputValue(),'0.45');await page.getByRole('button',{name:'Withdraw the plug fully',exact:true}).click();assert.equal(await reading('Insertion').textContent(),'0%');assert.equal(await reading('Shutter').textContent(),'Closed');
  await setup(3);await page.locator('[data-play]').click();await finished(1);const forwardReplay=await page.locator('[data-play]').evaluate(button=>{button.click();return document.querySelector('[data-control="insertion"]').value;});assert.equal(forwardReplay,'0.53');await page.locator('[data-play]').click();
  await page.locator('[data-result]').click();assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Connected desk lamp');await page.locator('.daily-heading h1').click();assert.equal(await page.locator('.daily-part-detail h3').count(),0);await page.locator('[data-view="reset"]').click();await page.locator('[data-separation]').fill('100');assert.equal(await page.locator('.daily-inventory-labels [data-category]').count(),6);for(const view of ['in','out']){await page.locator(`[data-view="${view}"]`).click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');}await picture(`separated-${width}`);await page.locator('[data-reassemble]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'0');
 }
 assert.deepEqual(errors,[]);console.log('PASS socket browser: twelve independent preset/viewport cases, both playback directions, contact order, switching without movement, pause/reset/step, directional completion replay, removal, selection dismissal and zoom-only buttons.');
}catch(error){console.error(error);await page?.screenshot({path:out+'/failure.png',fullPage:true,timeout:5000}).catch(()=>{});throw error;}
finally{await writeFile(out+'/browser.json',JSON.stringify({base,browser:browser.version(),cases,errors},null,2)+'\n');await browser.close();}

import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {createWindowShadeModel} from './window-shade-model.js';
const m=createWindowShadeModel(),part=id=>m.parts.find(p=>p.id===id).object;
const reference=m.getState().wireLength,initialRadius=m.getState().springRadius;
let poses=0;
function check(){
 m.root.updateMatrixWorld(true);const state=m.getState(),mesh=part('spring').children[0],path=mesh.geometry.parameters.path;
 let measured=0;
 for(const curve of path.curves){let before=curve.getPoint(0);for(let i=1;i<=5000;i++){const after=curve.getPoint(i/5000);measured+=before.distanceTo(after);before=after;}}
 assert.ok(Math.abs(measured-reference)<.0003,'independent dense integration preserves wire length');
 assert.ok(Math.abs(path.getLength()-reference)<1e-8,'analytic full path preserves wire length');
 assert.deepEqual(path.getPoint(0).toArray(),[-.88,0,0]);const endPoint=path.getPoint(1);assert.ok(Math.abs(endPoint.x-.88)<1e-9&&Math.abs(Math.hypot(endPoint.y,endPoint.z)-.065)<1e-9,'moving wire end attaches to collar');
 for(let i=1;i<path.curves.length;i++)assert.ok(path.curves[i-1].getPoint(1).distanceTo(path.curves[i].getPoint(0))<1e-9,'continuous wire at every lead junction');
 assert.deepEqual(path.curves[0].v2.toArray(),[-.88,.11,0]);
 const moving=part('moving-anchor').localToWorld(new THREE.Vector3(0,.11,0)),end=part('spring').localToWorld(path.curves.at(-1).v1.clone());assert.ok(moving.distanceTo(end)<1e-8,'wire follows real rotating anchor');
 const helix=path.curves[2],mid=helix.getPoint(.5),radius=Math.hypot(mid.y,mid.z);assert.ok(Math.abs(radius-state.springRadius)<1e-9);
 assert.ok(radius-.006>.03,'wound wire clears fixed rod');assert.ok(radius+.006<.2,'wire clears roller shell');
 part('moving-anchor').traverse(node=>{if(!node.geometry)return;const p=node.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=part('assembly').worldToLocal(node.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i)));assert.ok(Math.hypot(v.y,v.z)>.03,'all moving anchor vertices clear the fixed rod');}});
 const positions=mesh.geometry.attributes.position;for(let i=0;i<positions.count;i++){const p=new THREE.Vector3().fromBufferAttribute(positions,i);if(Math.abs(p.x)<.74){const radial=Math.hypot(p.y,p.z);assert.ok(radial>.03&&radial<.2,'rendered wire clears rod and tube');}}
 const phase=14*2*Math.PI+part('roller').rotation.x,pitch=1.52*2*Math.PI/phase;assert.ok(pitch>.012,'successive coil turns clear one wire diameter');
 assert.ok(radius<=initialRadius+1e-9);poses++;
}
const supports=part('supports').children,rightWalls=supports.slice(-4).map(node=>new THREE.Box3().setFromObject(node)),tang=new THREE.Box3().setFromObject(part('shaft').children[1]);assert.ok(Math.abs(rightWalls[0].max.z-tang.min.z)<1e-8&&Math.abs(rightWalls[1].min.z-tang.max.z)<1e-8,'tang fits bracket slot sides');assert.ok(Math.abs(rightWalls[2].max.y-tang.min.y)<1e-8&&Math.abs(rightWalls[3].min.y-tang.max.y)<1e-8,'tang fits bracket slot top/bottom');
const roundRod=new THREE.Box3().setFromObject(part('shaft').children[0]);assert.ok(rightWalls.every(wall=>!wall.intersectsBox(roundRod)),'round rod transitions to tang before the narrow slot');
check();m.update({coverage:1});for(let i=0;i<150&&!m.getState().complete;i++){m.advance(.1);if(i%4===0)check();}assert.equal(m.getState().held,true);assert.ok(m.getState().springRadius<initialRadius*.91);check();
const woundRadius=m.getState().springRadius;m.update({operation:1,release:0});m.advance(3);assert.ok(Math.abs(m.getState().springRadius-woundRadius)<1e-9);check();
m.update({release:1});for(let i=0;i<70&&!m.getState().complete;i++){m.advance(.1);if(i%3===0)check();}assert.equal(m.getState().stage,'raised');assert.ok(Math.abs(m.getState().springRadius-initialRadius)<1e-9);check();m.dispose();
console.log(`PASS spring geometry: ${poses} winding/held/rewinding poses; independent wire length, continuous leads, both real anchors, rendered rod/tube clearance and turn spacing.`);
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/window-shade-winding-spring`);await page.getByRole('heading',{name:'Window-shade winding spring',exact:true}).waitFor();
 const isolated=page.getByRole('checkbox',{name:'Isolate selected part',exact:true});assert.equal(await isolated.isChecked(),false);assert.match(await page.locator('.daily-part-detail').textContent(),/Axial winding spring/);await page.screenshot({path:'/tmp/howthingswork-shade-spring-lesson.png',fullPage:true});
 const preset=async i=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();assert.equal(await isolated.isChecked(),false);assert.match(await page.locator('.daily-part-detail').textContent(),/Axial winding spring/);};
 const run=()=>page.getByRole('button',{name:'Run selected action',exact:true}).click(),held=()=>page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Shade held'));
 await preset(0);await page.getByRole('button',{name:'Advance one step',exact:true}).click();assert.match(await page.locator('.daily-readings').textContent(),/Lowering/);await run();await held();assert.match(await page.locator('.daily-part-detail').textContent(),/Window and spring roller/);
 await preset(1);await run();await held();assert.match(await page.locator('.daily-readings').textContent(),/window fully covered/);await page.getByRole('combobox',{name:'Run action',exact:true}).selectOption('1');await page.getByRole('button',{name:'Connected roller mechanism',exact:true}).click();await page.getByRole('button',{name:'Axial winding spring',exact:true}).click();await page.getByRole('button',{name:'Front',exact:true}).click();await run();await held();assert.match(await page.locator('.daily-readings').textContent(),/Upper pawl against a fixed stop/);
 await preset(2);await run();await held();await page.getByRole('combobox',{name:'Run action',exact:true}).selectOption('1');await page.getByRole('button',{name:'Connected roller mechanism',exact:true}).click();await page.getByRole('button',{name:'Axial winding spring',exact:true}).click();await page.getByRole('button',{name:'Front',exact:true}).click();await run();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Shade raised'));assert.match(await page.locator('.daily-part-detail').textContent(),/Window and spring roller/);
 await isolated.check();await page.getByRole('button',{name:'Reset experiment',exact:true}).click();assert.equal(await isolated.isChecked(),false);assert.match(await page.locator('.daily-part-detail').textContent(),/Axial winding spring/);await page.getByRole('button',{name:'The roller end turns relative to the fixed rod end.',exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log('PASS shade spring browser: dedicated route, initial connected front view, all three experiments, whole-window results, reset context, quiz and mobile.');
}finally{await browser.close();}

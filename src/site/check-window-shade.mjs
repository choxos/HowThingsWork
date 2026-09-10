import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {createWindowShadeModel} from './window-shade-model.js';
const m=createWindowShadeModel(),object=id=>m.parts.find(p=>p.id===id).object;
const fixed=object('shaft').matrixWorld.clone();
m.root.updateMatrixWorld(true);fixed.copy(object('shaft').matrixWorld);
const cam=object('hub').children[0],positions=cam.geometry.attributes.position,triangles=[];
for(let i=0;i<positions.count;i+=3){const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(positions,i+j));if(v.every(p=>Math.abs(p.x)<1e-7))triangles.push(new THREE.Triangle(...v));}
assert.ok(triangles.length>4);
let poses=0;
function geometry(){
 m.root.updateMatrixWorld(true);const state=m.getState();assert.ok(object('shaft').matrixWorld.equals(fixed),'central shaft does not rotate');
 const coil=object('spring').children[0].geometry.parameters.path,first=coil.getPoint(0),last=coil.getPoint(1);
 assert.deepEqual(first.toArray(),[-.88,0,0]);assert.ok(Math.abs(last.x-.88)<1e-9&&Math.abs(Math.hypot(last.y,last.z)-.065)<1e-9,'moving end attaches off-axis to collar');
 const start=coil.curves[0].v2,end=coil.curves.at(-1).v1,moving=object('moving-anchor').localToWorld(new THREE.Vector3(0,.11,0)),endWorld=object('spring').localToWorld(end.clone());
 assert.ok(moving.distanceTo(endWorld)<1e-7,'moving coil end remains on its rotating anchor');assert.deepEqual(start.toArray(),[-.88,.11,0]);
 const sheet=new THREE.Box3().setFromObject(object('fabric')),rail=new THREE.Box3().setFromObject(object('rail').children[0]);
 assert.ok(Math.abs(sheet.min.y-rail.max.y)<1e-7,'fabric terminates at the rail');assert.ok(Math.abs(rail.max.y-rail.min.y-.06)<1e-6,'rail is not stretched');
 assert.equal(object('carrier').rotation.x,object('roller').rotation.x);assert.equal(object('spool').rotation.x,object('roller').rotation.x);
 const wound=object('spool').children[0],vertices=wound.geometry.attributes.position;for(let i=0;i<vertices.count;i+=8){const point=object('assembly').worldToLocal(wound.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices,i)));assert.ok(Math.abs(Math.hypot(point.y,point.z)-state.rollerRadius)<1e-7,'rendered wound radius matches transferred cloth');}
 const rollRadius=state.rollerRadius,rolledLength=Math.PI*(rollRadius*rollRadius-.2*.2)/.012;
 assert.ok(Math.abs(rolledLength+state.extension-2.35)<1e-9,'cloth length is conserved');
 const glass=object('window').children[4],glassBounds=new THREE.Box3().setFromObject(glass),overlap=Math.max(0,Math.min(sheet.max.y,glassBounds.max.y)-Math.max(sheet.min.y,glassBounds.min.y));
 assert.ok(sheet.min.x<=glassBounds.min.x&&sheet.max.x>=glassBounds.max.x,'fabric spans the full window width');
 assert.ok(Math.abs(overlap/(glassBounds.max.y-glassBounds.min.y)-state.coverage)<1e-6,'reported coverage matches actual window overlap');
 for(const id of ['pawl-0','pawl-1'])object(id).traverse(mesh=>{if(!mesh.geometry)return;const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const q=cam.worldToLocal(mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i)));if(q.x<1e-6||q.x>.025-1e-6)continue;q.x=0;for(const triangle of triangles){if(!triangle.containsPoint(q))continue;const bary=triangle.getBarycoord(q,new THREE.Vector3());assert.ok(Math.min(bary.x,bary.y,bary.z)<1e-5,`pawl geometry penetrates fixed ratchet during ${state.stage} at ${state.angle}`);}}});
 poses++;
}
for(const coverage of [.2,.6,1]){m.reset();m.update({coverage});for(let i=0;i<360&&!m.getState().complete;i++){m.advance(.05);if(i%4===0)geometry();}assert.equal(m.getState().held,true);assert.ok(Math.abs(m.getState().angle/(Math.PI/2)-Math.round(m.getState().angle/(Math.PI/2)))<1e-9);geometry();if(coverage===1)assert.equal(m.getState().coverage,1);
 const heldAngle=m.getState().angle;m.update({operation:1,release:0});for(let i=0;i<80&&!m.getState().complete;i++){m.advance(.05);geometry();}assert.equal(m.getState().held,true);assert.equal(m.getState().angle,heldAngle);
 m.update({release:1});for(let i=0;i<180&&!m.getState().complete;i++){m.advance(.05);if(i%3===0)geometry();}assert.equal(m.getState().stage,'raised');assert.equal(m.getState().coverage,0);geometry();}
for(const hz of [30,60,144]){m.reset();for(let i=0;i<hz*15;i++)m.advance(1/hz);assert.equal(m.getState().stage,'held');const angle=m.getState().angle;m.update({operation:1,release:0});for(let i=0;i<hz*3;i++)m.advance(1/hz);assert.equal(m.getState().angle,angle);m.update({release:1});for(let i=0;i<hz*6;i++)m.advance(1/hz);assert.equal(m.getState().stage,'raised');}
m.reset();m.advance(.4);const before=m.getState().angle;m.update({release:0});assert.equal(m.getState().angle,before);geometry();m.reset();assert.equal(m.getState().angle,0);m.dispose();
console.log(`PASS window shade geometry: ${poses} literal mesh poses, fixed hub, attached spring ends, rigid rail, conserved cloth and actual coverage; gentle catch, brisk rewind and 30/60/144 Hz.`);
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/window-shade`);await page.getByRole('heading',{name:'Window shade',exact:true}).waitFor();
 const setup=async i=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();};
 const run=()=>page.getByRole('button',{name:'Run selected action',exact:true}).click(),held=()=>page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Shade held'));
 await setup(0);await run();await held();assert.match(await page.locator('.daily-readings').textContent(),/window fully covered/);await page.screenshot({path:'/tmp/howthingswork-shade-covered.png',fullPage:true});
 await setup(1);await run();await held();await page.getByRole('combobox',{name:'Run action',exact:true}).selectOption('1');await run();await held();assert.match(await page.locator('.daily-readings').textContent(),/Upper pawl against a fixed stop/);
 await setup(2);await run();await held();await page.getByRole('combobox',{name:'Run action',exact:true}).selectOption('1');await run();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Shade raised'));await page.screenshot({path:'/tmp/howthingswork-shade-raised.png',fullPage:true});
 await page.getByRole('button',{name:'Connected roller mechanism',exact:true}).click();await page.getByRole('button',{name:'Pawls and fixed ratchet',exact:true}).click();await page.getByRole('checkbox',{name:'Isolate selected part',exact:true}).check();await page.getByRole('button',{name:'Side',exact:true}).click();await page.getByRole('checkbox',{name:'Show labels',exact:true}).check();await page.screenshot({path:'/tmp/howthingswork-shade-pawls.png',fullPage:true});
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();await page.getByRole('button',{name:'Advance one step',exact:true}).click();assert.match(await page.locator('.daily-readings').textContent(),/Lowering/);await page.getByRole('button',{name:'From work stored in the spring while lowering the shade.',exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log('PASS window shade browser: all three presets, full coverage, gentle re-catch, complete rewind, internal pawl view, reset, step, quiz and mobile.');
}finally{await browser.close();}

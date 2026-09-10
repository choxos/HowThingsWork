import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {createRatchetModel} from './ratchet-model.js';

let poses=0;
for(const hz of [30,60,144]){
 const m=createRatchetModel(),get=id=>m.parts.find(p=>p.id===id).object,wheel=get('ratchet'),pawl=get('pawl'),gear=wheel.children.find(o=>o.isMesh),polygon=gear.geometry.parameters.shapes.getPoints();
 const inside=p=>{let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;};
 const edgeDistance=p=>Math.min(...polygon.map((a,i)=>{const b=polygon[(i+1)%polygon.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}));
 const origin=new THREE.Vector3(),fixed=get('axle').position.clone();
 function check(){m.root.updateMatrixWorld(true);assert.ok(Math.abs(wheel.rotation.z+m.getState().angle)<1e-12);assert.deepEqual(get('axle').position,fixed);assert.ok(m.getState().clearance>=-1e-8);pawl.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){origin.fromBufferAttribute(a,i);o.localToWorld(origin);gear.worldToLocal(origin);assert.ok(!inside(origin)||edgeDistance(origin)<1e-7||Math.hypot(origin.x,origin.y)<.08,'actual pawl mesh vertex outside toothed wheel');}});poses++;}
 function run(){for(let i=0;i<hz*15&&!m.getState().complete;i++){m.advance(1/hz);if(i%Math.ceil(hz/20)===0)check();}assert.equal(m.getState().complete,true);check();}
 check();run();assert.equal(m.getState().position,3);assert.equal(m.getState().held,true);assert.equal(m.getState().beta,0);
 const toe=pawl.localToWorld(new THREE.Vector3(.16,1.065,0));get('assembly').worldToLocal(toe);assert.ok(Math.abs(toe.y-.025)<1e-12,'toe radius touches radial stopping face');
 m.update({direction:-1});run();assert.equal(m.getState().position,3);assert.equal(m.getState().blocked,true);
 m.update({release:1});run();assert.equal(m.getState().position,0);assert.ok(m.getState().clearance>.3);
 m.update({direction:1,stroke:6,release:0});run();assert.equal(m.getState().position,6);m.update({stroke:5});run();assert.equal(m.getState().position,11);
 m.reset();assert.equal(m.getState().position,0);assert.equal(m.getState().complete,false);m.dispose();
}
for(const time of [.1,.3,.65,.67,.8,1.2]){const m=createRatchetModel();m.advance(time);const before=m.getState().angle;m.update({direction:-1});m.advance(20);assert.ok(m.getState().angle<=before);assert.equal(m.getState().beta,0);assert.equal(m.getState().blocked,true);m.reset();m.advance(time);m.update({stroke:2});m.advance(20);assert.equal(m.getState().beta,0);assert.equal(m.getState().held,true);m.dispose();}
for(const hz of [30,60,144])for(const direction of [-1,1])for(const release of [0,1])for(let stroke=1;stroke<=6;stroke++){const m=createRatchetModel();m.reset({position:6});m.update({direction,release,stroke});for(let i=0;i<hz*15&&!m.getState().complete;i++)m.advance(1/hz);assert.equal(m.getState().complete,true);assert.ok(Math.abs(m.getState().position-(direction===-1&&!release?6:6+direction*stroke))<1e-9);m.dispose();}
console.log(`PASS ${poses} actual mesh poses, contact at stopping face, cumulative progress, blocked reverse, release, reset and 30/60/144 Hz.`);
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/ratchet`);await page.getByRole('heading',{name:'Ratchet',exact:true}).waitFor();
 const play=()=>page.getByRole('button',{name:'Run selected action',exact:true}).click(),wait=text=>page.waitForFunction(t=>document.querySelector('.daily-readings')?.textContent.includes(t)&&document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',text);
 await play();await wait('Pawl holding');assert.match(await page.locator('.daily-readings').textContent(),/90.0°/);
 await page.getByRole('combobox',{name:'Requested direction',exact:true}).selectOption('-1');await play();await wait('Reverse blocked');assert.match(await page.locator('.daily-readings').textContent(),/90.0°/);
 await page.getByRole('combobox',{name:'Holding pawl',exact:true}).selectOption('1');await play();await wait('Pawl released');assert.match(await page.locator('.daily-readings').textContent(),/0.0°/);
 await page.screenshot({path:'/tmp/howthingswork-ratchet-released.png'});
 await play();await wait('Pawl holding');assert.match(await page.locator('.daily-readings').textContent(),/90.0°/);
 for(const [i,initial,final,direction,release,outcome] of [[0,0,90,1,0,'Pawl holding'],[1,90,90,-1,0,'Reverse blocked'],[2,90,0,-1,1,'Pawl released']]){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();assert.ok((await page.locator('.daily-readings').textContent()).includes(initial.toFixed(1)+'°'));assert.equal(await page.getByRole('combobox',{name:'Requested direction',exact:true}).inputValue(),String(direction));assert.equal(await page.getByRole('combobox',{name:'Holding pawl',exact:true}).inputValue(),String(release));await play();await wait(outcome);assert.ok((await page.locator('.daily-readings').textContent()).includes(final.toFixed(1)+'°'));}
 await page.getByRole('button',{name:'The solid obstacle in the tooth’s path is removed.',exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log('PASS browser: advance/hold/reverse/release, completed Play reset/restart, three experiment setups, quiz and mobile.');
}finally{await browser.close();}

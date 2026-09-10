import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {createMachine} from './machine-models.js';
const model=createMachine('Differential');
const outputs=['Left output wheel','Right output wheel'].map(name=>model.root.getObjectByName(name));
assert.ok(outputs.every(Boolean));
const centers=outputs.map(w=>w.position.clone());
for(const phase of [0,.13,.37,.5,1]){
 model.animate(phase);model.root.updateMatrixWorld(true);
 outputs.forEach((wheel,i)=>{assert.ok(wheel.position.equals(centers[i]));const axis=new THREE.Vector3(0,0,1).applyQuaternion(wheel.quaternion);assert.ok(axis.distanceTo(new THREE.Vector3(1,0,0))<1e-8,'output wheels keep their axle direction');});
 assert.equal(outputs[0].rotation.x,2*outputs[1].rotation.x,'the illustrated outputs turn at different speeds');
 if(phase>0)assert.ok(outputs.every(w=>Math.abs(w.rotation.x)>0),'both output wheels turn');
}
model.dispose();
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/differential`);
 const slider=page.getByRole('slider',{name:'Turn the wheels',exact:true});await slider.waitFor();
 await page.evaluate(async()=>{const source=await(await fetch('/src/site/machine-viewer.js')).text(),url=source.match(/import \* as THREE from ["']([^"']+)["']/)[1],T=await import(url);T.Object3D.prototype.onBeforeRender=function(renderer,scene){window.differentialScene=scene;};});
 const pose=()=>page.evaluate(()=>['Left output wheel','Right output wheel'].map(name=>{const w=window.differentialScene.getObjectByName(name);return {rotation:w.rotation.x,position:w.position.toArray()};}));
 await slider.fill('0');const initial=await pose();await slider.fill('37');const moved=await pose();
 moved.forEach((wheel,i)=>{assert.notEqual(wheel.rotation,initial[i].rotation);assert.deepEqual(wheel.position,initial[i].position);});assert.equal(moved[0].rotation,2*moved[1].rotation);
 await page.getByRole('button',{name:'Look inside',exact:true}).click();await slider.fill('100');assert.ok((await pose()).every((w,i)=>w.rotation!==moved[i].rotation));
 await page.screenshot({path:'/tmp/howthingswork-differential-moving-wheels.png'});assert.deepEqual(errors,[]);
 console.log('PASS Differential: both output wheels rotate at the illustrated different speeds, remain on their axles, and respond through the live slider with cover on/off.');
}finally{await browser.close();}
